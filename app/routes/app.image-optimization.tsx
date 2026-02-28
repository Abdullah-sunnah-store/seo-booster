import type { LoaderFunctionArgs, ActionFunctionArgs, ShouldRevalidateFunction } from "@remix-run/node";
import { useLoaderData, useFetcher, useSearchParams, useRevalidator } from "@remix-run/react";

// Prevent loader re-running after individual optimize actions so images
// don't disappear from the list. Manual "Sync Now" still revalidates.
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formData,
  defaultShouldRevalidate,
}) => {
  if (formData?.get("suppressRevalidate") === "true") return false;
  return defaultShouldRevalidate;
};
import {
  Page,
  Layout,
  Card,
  DataTable,
  Thumbnail,
  Button,
  InlineStack,
  BlockStack,
  Text,
  Select,
  Badge,
  Box,
  Pagination,
  Banner,
  ProgressBar,
} from "@shopify/polaris";
import { useState, useCallback, useRef } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const SIZE_THRESHOLD = 1024 * 1024; // 1 MB in bytes

interface ImageData {
  id: string;
  url: string;
  altText: string | null;
  originalSize: number;
  resourceType: string;
  resourceTitle: string;
  resourceId: string;
  isOptimized: boolean;
  optimizedSize?: number | null;
  savedPercent?: number | null;
}

interface LocalOptimizedData {
  size: number;
  url: string;
}

// Fetch file size via HEAD with fallback (used only for collection images)
async function getImageSize(url: string): Promise<number> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    const cl = res.headers.get("content-length");
    if (cl) return parseInt(cl, 10);
    const fullRes = await fetch(url);
    const buf = await fullRes.arrayBuffer();
    return buf.byteLength;
  } catch {
    return 0;
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const perPage = parseInt(url.searchParams.get("perPage") || "10");

  // Get store record for DB lookups
  const store = await db.store.findUnique({ where: { shop } });
  const storeId = store?.id ?? null;

  // Load already-optimized records from DB
  const dbOptimizations = storeId
    ? await db.imageOptimization.findMany({
        where: { storeId, status: "optimized" },
        select: { imageUrl: true, optimizedSize: true, savedPercent: true },
      })
    : [];
  const optimizationMap = new Map(dbOptimizations.map((o) => [o.imageUrl, o]));

  type RawImage = {
    id: string;
    url: string;
    altText: string | null;
    resourceType: string;
    resourceTitle: string;
    resourceId: string;
    fileSize: number; // from Shopify API or HEAD
  };

  const allImages: RawImage[] = [];

  // Fetch ALL product images with pagination + use originalSource.fileSize
  // (no HEAD requests needed — Shopify returns the real file size)
  try {
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      const productsResponse = await admin.graphql(
        `
        query GetProducts($cursor: String) {
          products(first: 50, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                title
                media(first: 50) {
                  edges {
                    node {
                      ... on MediaImage {
                        id
                        image {
                          url
                          altText
                        }
                        originalSource {
                          fileSize
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        `,
        { variables: { cursor } }
      );
      const productsData = await productsResponse.json();
      const productsPage = productsData.data?.products;
      hasNextPage = productsPage?.pageInfo?.hasNextPage ?? false;
      cursor = productsPage?.pageInfo?.endCursor ?? null;

      for (const product of productsPage?.edges ?? []) {
        for (const media of product.node.media?.edges ?? []) {
          const node = media.node;
          if (node.id && node.image?.url) {
            const fileSize = node.originalSource?.fileSize ?? 0;
            allImages.push({
              id: node.id,
              url: node.image.url,
              altText: node.image.altText ?? null,
              resourceType: "product",
              resourceTitle: product.node.title,
              resourceId: product.node.id,
              fileSize,
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to fetch product images:", e);
  }

  // Fetch ALL collection images with pagination
  try {
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      const collectionsResponse = await admin.graphql(
        `
        query GetCollections($cursor: String) {
          collections(first: 50, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                title
                image {
                  id
                  url
                  altText
                }
              }
            }
          }
        }
        `,
        { variables: { cursor } }
      );
      const collectionsData = await collectionsResponse.json();
      const collectionsPage = collectionsData.data?.collections;
      hasNextPage = collectionsPage?.pageInfo?.hasNextPage ?? false;
      cursor = collectionsPage?.pageInfo?.endCursor ?? null;

      for (const collection of collectionsPage?.edges ?? []) {
        if (collection.node.image) {
          allImages.push({
            id:
              collection.node.image.id ||
              `collection-${collection.node.id}`,
            url: collection.node.image.url,
            altText: collection.node.image.altText ?? null,
            resourceType: "collection",
            resourceTitle: collection.node.title,
            resourceId: collection.node.id,
            fileSize: 0, // will fetch via HEAD below
          });
        }
      }
    }
  } catch (e) {
    console.error("Failed to fetch collection images:", e);
  }

  // For collection images with unknown size, fetch via HEAD concurrently
  const collectionImages = allImages.filter(
    (img) => img.resourceType === "collection" && img.fileSize === 0
  );
  if (collectionImages.length > 0) {
    const sizes = await Promise.all(
      collectionImages.map((img) => getImageSize(img.url))
    );
    collectionImages.forEach((img, i) => {
      img.fileSize = sizes[i];
    });
  }

  // Filter to >1 MB only
  const filteredImages: ImageData[] = [];
  for (const img of allImages) {
    if (img.fileSize >= SIZE_THRESHOLD) {
      const dbOpt = optimizationMap.get(img.url);
      filteredImages.push({
        id: img.id,
        url: img.url,
        altText: img.altText,
        resourceType: img.resourceType,
        resourceTitle: img.resourceTitle,
        resourceId: img.resourceId,
        originalSize: img.fileSize,
        isOptimized: !!dbOpt,
        optimizedSize: dbOpt?.optimizedSize ?? null,
        savedPercent: dbOpt?.savedPercent ?? null,
      });
    }
  }

  const totalImages = filteredImages.length;
  const totalPages = Math.ceil(totalImages / perPage) || 1;
  const startIndex = (page - 1) * perPage;
  const paginatedImages = filteredImages.slice(startIndex, startIndex + perPage);

  return {
    images: paginatedImages,
    totalImages,
    totalPages,
    currentPage: page,
    perPage,
    storeId,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "uploadOptimized") {
    const imageId = formData.get("imageId") as string;
    const resourceType = formData.get("resourceType") as string;
    const resourceId = formData.get("resourceId") as string;
    const imageUrl = formData.get("imageUrl") as string;
    const compressedFile = formData.get("compressedImage") as File;
    const originalSize = parseInt(formData.get("originalSize") as string) || 0;

    if (!compressedFile) {
      return { success: false, error: "No compressed image provided", imageId };
    }

    try {
      const compressedSize = compressedFile.size;
      const filename =
        (formData.get("filename") as string) || "optimized-image.jpg";

      // Step 1: Create staged upload
      const stagedUploadResponse = await admin.graphql(
        `
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters {
                name
                value
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
        {
          variables: {
            input: [
              {
                resource: "IMAGE",
                filename,
                mimeType: "image/jpeg",
                fileSize: compressedSize.toString(),
                httpMethod: "POST",
              },
            ],
          },
        }
      );

      const stagedUploadData = await stagedUploadResponse.json();

      if (
        stagedUploadData.data?.stagedUploadsCreate?.userErrors?.length > 0
      ) {
        return {
          success: false,
          error:
            stagedUploadData.data.stagedUploadsCreate.userErrors[0]?.message ||
            "Staged upload failed",
          imageId,
        };
      }

      const target =
        stagedUploadData.data?.stagedUploadsCreate?.stagedTargets?.[0];
      if (!target) {
        return { success: false, error: "No staged target returned", imageId };
      }

      // Step 2: Upload compressed file to staged URL
      const uploadFormData = new FormData();
      for (const param of target.parameters) {
        uploadFormData.append(param.name, param.value);
      }
      uploadFormData.append("file", compressedFile, filename);

      const uploadResponse = await fetch(target.url, {
        method: "POST",
        body: uploadFormData,
      });

      if (!uploadResponse.ok) {
        return {
          success: false,
          error: "Failed to upload to Shopify",
          imageId,
        };
      }

      const newImageUrl = target.resourceUrl;
      let imageReplaced = false;

      // Step 3a: Replace product image
      if (
        resourceType === "product" &&
        imageId.includes("gid://shopify/")
      ) {
        try {
          const deleteMediaResponse = await admin.graphql(
            `
            mutation productDeleteMedia($productId: ID!, $mediaIds: [ID!]!) {
              productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
                deletedMediaIds
                mediaUserErrors {
                  field
                  message
                }
              }
            }
          `,
            {
              variables: { productId: resourceId, mediaIds: [imageId] },
            }
          );
          await deleteMediaResponse.json();

          const createMediaResponse = await admin.graphql(
            `
            mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
              productCreateMedia(productId: $productId, media: $media) {
                media {
                  ... on MediaImage {
                    id
                    image { url }
                  }
                }
                mediaUserErrors {
                  field
                  message
                }
              }
            }
          `,
            {
              variables: {
                productId: resourceId,
                media: [
                  {
                    originalSource: newImageUrl,
                    mediaContentType: "IMAGE",
                  },
                ],
              },
            }
          );
          const createMediaData = await createMediaResponse.json();
          if (
            !createMediaData.data?.productCreateMedia?.mediaUserErrors?.length
          ) {
            imageReplaced = true;
          }
        } catch (e) {
          console.error("Failed to replace product image:", e);
        }
      }

      // Step 3b: Replace collection image
      if (resourceType === "collection") {
        try {
          const updateCollectionResponse = await admin.graphql(
            `
            mutation collectionUpdate($input: CollectionInput!) {
              collectionUpdate(input: $input) {
                collection {
                  id
                  image { url }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
            {
              variables: {
                input: { id: resourceId, image: { src: newImageUrl } },
              },
            }
          );
          const updateData = await updateCollectionResponse.json();
          if (!updateData.data?.collectionUpdate?.userErrors?.length) {
            imageReplaced = true;
          }
        } catch (e) {
          console.error("Failed to update collection image:", e);
        }
      }

      const savedBytes = originalSize - compressedSize;
      const savedPercent =
        originalSize > 0
          ? Math.round((savedBytes / originalSize) * 100)
          : 0;

      // Step 4: Save optimization record to DB
      try {
        const store = await db.store.findUnique({ where: { shop } });
        if (store && imageUrl) {
          const existing = await db.imageOptimization.findFirst({
            where: { storeId: store.id, imageUrl },
          });
          if (existing) {
            await db.imageOptimization.update({
              where: { id: existing.id },
              data: {
                optimizedSize: compressedSize,
                savedBytes,
                savedPercent,
                status: "optimized",
              },
            });
          } else {
            await db.imageOptimization.create({
              data: {
                storeId: store.id,
                imageUrl,
                originalSize,
                optimizedSize: compressedSize,
                savedBytes,
                savedPercent,
                pageType: resourceType,
                resourceId,
                status: "optimized",
              },
            });
          }
        }
      } catch (dbErr) {
        console.error("Failed to save optimization to DB:", dbErr);
      }

      return {
        success: true,
        imageId,
        originalSize,
        optimizedSize: compressedSize,
        newUrl: newImageUrl,
        savedBytes,
        savedPercent,
        imageReplaced,
      };
    } catch (error) {
      console.error("Upload failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        imageId,
      };
    }
  }

  return { success: false };
};

// Client-side image compression using Canvas API
function compressImage(
  imageUrl: string,
  quality: number
): Promise<{ blob: Blob; originalSize: number; compressedSize: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = async () => {
      try {
        const response = await fetch(imageUrl);
        const originalBlob = await response.blob();
        const originalSize = originalBlob.size;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (compressedBlob) => {
            if (compressedBlob) {
              resolve({
                blob: compressedBlob,
                originalSize,
                compressedSize: compressedBlob.size,
              });
            } else {
              reject(new Error("Failed to compress image"));
            }
          },
          "image/jpeg",
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const filename = urlObj.pathname.split("/").pop() || "image.jpg";
    return filename.split("?")[0];
  } catch {
    return "image.jpg";
  }
}

export default function ImageOptimization() {
  const { images, totalImages, totalPages, currentPage, perPage } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [, setSearchParams] = useSearchParams();
  const revalidator = useRevalidator();

  const [compressionLevel, setCompressionLevel] = useState("0.8");
  const [localOptimized, setLocalOptimized] = useState<
    Record<string, LocalOptimizedData>
  >({});
  const [optimizingId, setOptimizingId] = useState<string | null>(null);
  const [isOptimizingAll, setIsOptimizingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const processingRef = useRef<Set<string>>(new Set());

  const isSubmitting = fetcher.state === "submitting";
  const isLoading = fetcher.state === "loading";

  const handlePerPageChange = useCallback(
    (value: string) => {
      setSearchParams({ page: "1", perPage: value });
    },
    [setSearchParams]
  );

  const handlePageChange = useCallback(
    (direction: "previous" | "next") => {
      const newPage =
        direction === "next" ? currentPage + 1 : currentPage - 1;
      setSearchParams({ page: newPage.toString(), perPage: perPage.toString() });
    },
    [currentPage, perPage, setSearchParams]
  );

  const handleOptimize = useCallback(
    async (image: ImageData) => {
      if (processingRef.current.has(image.id)) return;
      processingRef.current.add(image.id);
      setOptimizingId(image.id);
      setError(null);

      try {
        const quality = parseFloat(compressionLevel);
        const result = await compressImage(image.url, quality);

        const compressedUrl = URL.createObjectURL(result.blob);
        setLocalOptimized((prev) => ({
          ...prev,
          [image.id]: { size: result.compressedSize, url: compressedUrl },
        }));

        const formData = new FormData();
        formData.append("action", "uploadOptimized");
        formData.append("imageId", image.id);
        formData.append("imageUrl", image.url);
        formData.append("resourceType", image.resourceType);
        formData.append("resourceId", image.resourceId);
        formData.append(
          "compressedImage",
          result.blob,
          getFilenameFromUrl(image.url)
        );
        formData.append("originalSize", result.originalSize.toString());
        formData.append("filename", getFilenameFromUrl(image.url));
        formData.append("suppressRevalidate", "true");

        fetcher.submit(formData, {
          method: "post",
          encType: "multipart/form-data",
        });

        const saved = result.originalSize - result.compressedSize;
        const pct = Math.round((saved / result.originalSize) * 100);
        setSuccessMessage(
          `Image optimized! Saved ${formatFileSize(saved)} (${pct}%)`
        );
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (err) {
        console.error("Optimization failed:", err);
        setError(
          err instanceof Error ? err.message : "Failed to optimize image"
        );
      } finally {
        setOptimizingId(null);
        processingRef.current.delete(image.id);
      }
    },
    [compressionLevel, fetcher]
  );

  const handleOptimizeAll = useCallback(async () => {
    setError(null);
    setIsOptimizingAll(true);
    setSuccessMessage("Starting batch optimization...");
    try {
      for (const image of images) {
        if (!image.isOptimized && !localOptimized[image.id]) {
          await handleOptimize(image);
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      setSuccessMessage("All images optimized!");
      setTimeout(() => setSuccessMessage(null), 5000);
    } finally {
      setIsOptimizingAll(false);
    }
  }, [images, localOptimized, handleOptimize]);

  const perPageOptions = [
    { label: "10", value: "10" },
    { label: "20", value: "20" },
    { label: "50", value: "50" },
    { label: "100", value: "100" },
  ];

  const compressionOptions = [
    { label: "10% (Lowest quality)", value: "0.1" },
    { label: "20%", value: "0.2" },
    { label: "30%", value: "0.3" },
    { label: "50% (Medium)", value: "0.5" },
    { label: "70%", value: "0.7" },
    { label: "80% (Recommended)", value: "0.8" },
    { label: "90% (High quality)", value: "0.9" },
  ];

  const rows = images.map((image) => {
    const local = localOptimized[image.id];
    const isOptimized = image.isOptimized || !!local;
    const isCurrentlyOptimizing = optimizingId === image.id;

    return [
      // Image + title
      <InlineStack gap="300" blockAlign="center" key={`thumb-${image.id}`}>
        <Thumbnail
          source={local?.url || image.url}
          alt={image.altText || "Image"}
          size="medium"
        />
        <BlockStack gap="100">
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {image.resourceTitle.length > 25
              ? image.resourceTitle.substring(0, 25) + "..."
              : image.resourceTitle}
          </Text>
          <Badge
            tone={
              image.resourceType === "product"
                ? "info"
                : image.resourceType === "collection"
                ? "success"
                : "attention"
            }
          >
            {image.resourceType}
          </Badge>
        </BlockStack>
      </InlineStack>,

      // Current size
      <Text as="span" variant="bodyMd" key={`size-${image.id}`}>
        {formatFileSize(image.originalSize)}
      </Text>,

      // Action
      isOptimized ? (
        <Badge tone="success" key={`btn-${image.id}`}>
          Optimized
        </Badge>
      ) : isCurrentlyOptimizing ? (
        <Box key={`btn-${image.id}`} minWidth="100px">
          <ProgressBar progress={50} size="small" tone="primary" />
        </Box>
      ) : (
        <Button
          key={`btn-${image.id}`}
          size="slim"
          onClick={() => handleOptimize(image)}
          disabled={isSubmitting || isLoading}
        >
          Optimize
        </Button>
      ),
    ];
  });

  return (
    <Page title="Image Optimization">
      <Layout>
        <Layout.Section>
          {error && (
            <Box paddingBlockEnd="400">
              <Banner tone="critical" onDismiss={() => setError(null)}>
                <p>{error}</p>
              </Banner>
            </Box>
          )}

          {successMessage && (
            <Box paddingBlockEnd="400">
              <Banner
                tone="success"
                onDismiss={() => setSuccessMessage(null)}
              >
                <p>{successMessage}</p>
              </Banner>
            </Box>
          )}

          <Card>
            <BlockStack gap="400">
              {/* Controls */}
              <InlineStack align="space-between">
                <InlineStack gap="300">
                  <Select
                    label="Quality"
                    labelInline
                    options={compressionOptions}
                    value={compressionLevel}
                    onChange={setCompressionLevel}
                  />
                  <Button
                    variant="primary"
                    onClick={handleOptimizeAll}
                    loading={isOptimizingAll}
                    disabled={isOptimizingAll || revalidator.state === "loading"}
                  >
                    Optimize All
                  </Button>
                  <Button
                    onClick={() => revalidator.revalidate()}
                    loading={revalidator.state === "loading"}
                    disabled={isSubmitting || revalidator.state === "loading"}
                  >
                    {revalidator.state === "loading" ? "Syncing..." : "Sync Now"}
                  </Button>
                </InlineStack>
                <InlineStack gap="300" blockAlign="center">
                  <Select
                    label="Per page"
                    labelInline
                    options={perPageOptions}
                    value={perPage.toString()}
                    onChange={handlePerPageChange}
                  />
                  <Text as="span" variant="bodySm" tone="subdued">
                    {totalImages} images &gt;1 MB
                  </Text>
                </InlineStack>
              </InlineStack>

              {/* Table */}
              <Box paddingBlockStart="200">
                {images.length === 0 ? (
                  <Banner tone="info">
                    <p>No images larger than 1 MB found.</p>
                  </Banner>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "text", "text"]}
                    headings={["Image", "Current Size", "Action"]}
                    rows={rows}
                  />
                )}
              </Box>

              {/* Pagination */}
              {totalPages > 1 && (
                <Box paddingBlockStart="400">
                  <InlineStack align="center" gap="200">
                    <Pagination
                      hasPrevious={currentPage > 1}
                      hasNext={currentPage < totalPages}
                      onPrevious={() => handlePageChange("previous")}
                      onNext={() => handlePageChange("next")}
                    />
                    <Text as="span" variant="bodySm" tone="subdued">
                      Page {currentPage} of {totalPages}
                    </Text>
                  </InlineStack>
                </Box>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
