import sharp from "sharp";

export interface ImageInfo {
  url: string;
  size: number;
  width?: number;
  height?: number;
  format?: string;
}

export interface OptimizedImage {
  buffer: Buffer;
  size: number;
  format: string;
  width: number;
  height: number;
}

/**
 * Fetch image info including actual file size
 */
export async function fetchImageInfo(url: string): Promise<ImageInfo> {
  try {
    // First try HEAD request to get size without downloading
    const headResponse = await fetch(url, { method: "HEAD" });
    const contentLength = headResponse.headers.get("content-length");

    if (contentLength) {
      return {
        url,
        size: parseInt(contentLength, 10),
      };
    }

    // If no content-length header, download the image to get size
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();

    return {
      url,
      size: buffer.byteLength,
    };
  } catch (error) {
    console.error("Failed to fetch image info:", error);
    return {
      url,
      size: 0,
    };
  }
}

/**
 * Download image from URL and return buffer
 */
export async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Optimize image using sharp
 * @param imageBuffer - Original image buffer
 * @param quality - Quality percentage (1-100), lower = more compression
 */
export async function optimizeImage(
  imageBuffer: Buffer,
  quality: number = 80
): Promise<OptimizedImage> {
  // Get original image metadata
  const metadata = await sharp(imageBuffer).metadata();
  const format = metadata.format || "jpeg";

  let optimizedBuffer: Buffer;

  // Optimize based on format
  switch (format) {
    case "png":
      optimizedBuffer = await sharp(imageBuffer)
        .png({
          quality,
          compressionLevel: 9,
          palette: true,
        })
        .toBuffer();
      break;

    case "webp":
      optimizedBuffer = await sharp(imageBuffer)
        .webp({
          quality,
          effort: 6,
        })
        .toBuffer();
      break;

    case "gif":
      // For GIFs, convert to webp for better compression or keep as is
      optimizedBuffer = await sharp(imageBuffer, { animated: true })
        .webp({
          quality,
          effort: 6,
        })
        .toBuffer();
      break;

    case "jpeg":
    case "jpg":
    default:
      optimizedBuffer = await sharp(imageBuffer)
        .jpeg({
          quality,
          progressive: true,
          mozjpeg: true,
        })
        .toBuffer();
      break;
  }

  const optimizedMetadata = await sharp(optimizedBuffer).metadata();

  return {
    buffer: optimizedBuffer,
    size: optimizedBuffer.length,
    format: optimizedMetadata.format || format,
    width: optimizedMetadata.width || 0,
    height: optimizedMetadata.height || 0,
  };
}

/**
 * Convert compression percentage to quality
 * e.g., 20% compression = 80% quality
 */
export function compressionToQuality(compressionPercent: number): number {
  return Math.max(10, Math.min(100, 100 - compressionPercent));
}

/**
 * Upload optimized image to Shopify using staged uploads
 */
export async function uploadToShopify(
  admin: any,
  imageBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string | null> {
  try {
    // Step 1: Create staged upload
    const stagedUploadResponse = await admin.graphql(`
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
    `, {
      variables: {
        input: [{
          resource: "IMAGE",
          filename: filename,
          mimeType: mimeType,
          fileSize: imageBuffer.length.toString(),
          httpMethod: "POST",
        }],
      },
    });

    const stagedUploadData = await stagedUploadResponse.json();

    if (stagedUploadData.data?.stagedUploadsCreate?.userErrors?.length > 0) {
      console.error("Staged upload errors:", stagedUploadData.data.stagedUploadsCreate.userErrors);
      return null;
    }

    const target = stagedUploadData.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target) {
      console.error("No staged target returned");
      return null;
    }

    // Step 2: Upload the file to the staged URL
    const formData = new FormData();

    // Add parameters from staged upload
    for (const param of target.parameters) {
      formData.append(param.name, param.value);
    }

    // Add the file
    const blob = new Blob([imageBuffer], { type: mimeType });
    formData.append("file", blob, filename);

    const uploadResponse = await fetch(target.url, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      console.error("Upload failed:", uploadResponse.status, await uploadResponse.text());
      return null;
    }

    return target.resourceUrl;
  } catch (error) {
    console.error("Failed to upload to Shopify:", error);
    return null;
  }
}

/**
 * Update product image with optimized version
 */
export async function updateProductImage(
  admin: any,
  productId: string,
  imageId: string,
  newImageUrl: string
): Promise<boolean> {
  try {
    // First, get the current image details
    const response = await admin.graphql(`
      mutation productImageUpdate($productId: ID!, $image: ImageInput!) {
        productImageUpdate(productId: $productId, image: $image) {
          image {
            id
            url
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        productId: productId,
        image: {
          id: imageId,
          src: newImageUrl,
        },
      },
    });

    const data = await response.json();

    if (data.data?.productImageUpdate?.userErrors?.length > 0) {
      console.error("Product image update errors:", data.data.productImageUpdate.userErrors);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to update product image:", error);
    return false;
  }
}

/**
 * Get MIME type from URL or format
 */
export function getMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
  };
  return mimeTypes[format.toLowerCase()] || "image/jpeg";
}

/**
 * Extract filename from URL
 */
export function getFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split("/").pop() || "image.jpg";
    // Remove query params from filename
    return filename.split("?")[0];
  } catch {
    return "image.jpg";
  }
}
