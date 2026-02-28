import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  useFetcher,
  useSearchParams,
  useRevalidator,
} from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  InlineStack,
  BlockStack,
  Box,
  TextField,
  Pagination,
  Banner,
  Tabs,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";

const MAX_META_LENGTH = 155;

interface ProductMeta {
  id: string;
  title: string;
  bodyHtml: string; // product description for AI context
  metaDescription: string;
  status: "missing" | "too-long" | "ok";
}

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") || "all"; // all | missing | too-long
  const page = parseInt(url.searchParams.get("page") || "1");
  const perPage = parseInt(url.searchParams.get("perPage") || "10");

  // Fetch ALL products (cursor-based pagination through Shopify)
  const allProducts: ProductMeta[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const res = await admin.graphql(
      `
      query GetProductsMeta($cursor: String) {
        products(first: 50, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              title
              descriptionHtml
              seo {
                description
              }
            }
          }
        }
      }
      `,
      { variables: { cursor } }
    );
    const data = await res.json();
    const productsPage = data.data?.products;
    hasNextPage = productsPage?.pageInfo?.hasNextPage ?? false;
    cursor = productsPage?.pageInfo?.endCursor ?? null;

    for (const edge of productsPage?.edges ?? []) {
      const node = edge.node;
      const desc: string = node.seo?.description ?? "";
      let status: ProductMeta["status"] = "ok";
      if (!desc || desc.trim() === "") status = "missing";
      else if (desc.length > MAX_META_LENGTH) status = "too-long";

      allProducts.push({
        id: node.id,
        title: node.title,
        bodyHtml: node.descriptionHtml ?? "",
        metaDescription: desc,
        status,
      });
    }
  }

  // Filter
  const filtered =
    filter === "missing"
      ? allProducts.filter((p) => p.status === "missing")
      : filter === "too-long"
      ? allProducts.filter((p) => p.status === "too-long")
      : allProducts;

  const totalMissing = allProducts.filter((p) => p.status === "missing").length;
  const totalTooLong = allProducts.filter((p) => p.status === "too-long").length;
  const totalOk = allProducts.filter((p) => p.status === "ok").length;

  const totalProducts = filtered.length;
  const totalPages = Math.ceil(totalProducts / perPage) || 1;
  const startIndex = (page - 1) * perPage;
  const paginatedProducts = filtered.slice(startIndex, startIndex + perPage);

  return {
    products: paginatedProducts,
    totalProducts,
    totalPages,
    currentPage: page,
    perPage,
    filter,
    stats: { totalMissing, totalTooLong, totalOk, total: allProducts.length },
  };
};

// ─── Action ──────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("action") as string;

  // Save meta description to Shopify
  if (actionType === "save") {
    const productId = formData.get("productId") as string;
    const description = formData.get("description") as string;

    try {
      const res = await admin.graphql(
        `
        mutation UpdateProductSEO($input: ProductInput!) {
          productUpdate(input: $input) {
            product {
              id
              seo { description }
            }
            userErrors { field message }
          }
        }
        `,
        {
          variables: {
            input: { id: productId, seo: { description } },
          },
        }
      );
      const data = await res.json();
      const errors = data.data?.productUpdate?.userErrors ?? [];
      if (errors.length > 0) {
        return { success: false, error: errors[0].message, productId };
      }
      return { success: true, productId };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "Save failed",
        productId,
      };
    }
  }


  return { success: false };
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function MetaDescriptionPage() {
  const {
    products,
    totalProducts,
    totalPages,
    currentPage,
    perPage,
    filter,
    stats,
  } = useLoaderData<typeof loader>();

  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const [, setSearchParams] = useSearchParams();

  // Local edits: productId → current textarea value
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of products) init[p.id] = p.metaDescription;
    return init;
  });

  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const tabs = [
    {
      id: "all",
      content: `All (${stats.total})`,
      accessibilityLabel: "All products",
    },
    {
      id: "missing",
      content: `Missing (${stats.totalMissing})`,
      accessibilityLabel: "Missing meta descriptions",
    },
    {
      id: "too-long",
      content: `Too Long (${stats.totalTooLong})`,
      accessibilityLabel: "Meta descriptions over 155 chars",
    },
  ];

  const selectedTab =
    filter === "missing" ? 1 : filter === "too-long" ? 2 : 0;

  const handleTabChange = useCallback(
    (index: number) => {
      const tabId = tabs[index].id;
      setSearchParams({ filter: tabId, page: "1", perPage: perPage.toString() });
    },
    [setSearchParams, perPage, tabs]
  );

  const handlePageChange = useCallback(
    (direction: "previous" | "next") => {
      const newPage =
        direction === "next" ? currentPage + 1 : currentPage - 1;
      setSearchParams({
        filter,
        page: newPage.toString(),
        perPage: perPage.toString(),
      });
    },
    [currentPage, filter, perPage, setSearchParams]
  );

  const handleDraftChange = useCallback(
    (productId: string, value: string) => {
      setDrafts((prev) => ({ ...prev, [productId]: value }));
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    },
    []
  );

  const handleSave = useCallback(
    async (productId: string) => {
      setSavingId(productId);
      setErrors((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });

      const form = new FormData();
      form.append("action", "save");
      form.append("productId", productId);
      form.append("description", drafts[productId] ?? "");

      fetcher.submit(form, { method: "post" });

      // Optimistic update
      setSavedIds((prev) => new Set([...prev, productId]));
      setSavingId(null);
    },
    [drafts, fetcher]
  );

  // Apply fetcher result (save errors)
  const lastData = fetcher.data as
    | { success: boolean; productId?: string; error?: string }
    | undefined;

  if (lastData && lastData.productId && !lastData.success && lastData.error) {
    const pid = lastData.productId;
    if (!errors[pid]) {
      setTimeout(() => {
        setErrors((prev) => ({ ...prev, [pid]: lastData.error! }));
        setSavingId(null);
      }, 0);
    }
  }

  const getStatusBadge = (status: ProductMeta["status"], currentDraft: string) => {
    const len = currentDraft.length;
    if (len === 0) return <Badge tone="critical">Missing</Badge>;
    if (len > MAX_META_LENGTH) return <Badge tone="warning">Too Long</Badge>;
    return <Badge tone="success">Good</Badge>;
  };

  const resourceName = { singular: "product", plural: "products" };

  return (
    <Page title="Meta Descriptions">
      <Layout>
        <Layout.Section>
          {/* Stats row */}
          <Box paddingBlockEnd="400">
            <InlineStack gap="300">
              <Card>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Missing
                  </Text>
                  <Text as="p" variant="headingLg" tone="critical">
                    {stats.totalMissing}
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Too Long (&gt;155)
                  </Text>
                  <Text as="p" variant="headingLg" tone="caution">
                    {stats.totalTooLong}
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Good
                  </Text>
                  <Text as="p" variant="headingLg" tone="success">
                    {stats.totalOk}
                  </Text>
                </BlockStack>
              </Card>
            </InlineStack>
          </Box>

          <Card padding="0">
            <Box padding="400" paddingBlockEnd="0">
              <InlineStack align="space-between" blockAlign="center">
                <Tabs
                  tabs={tabs}
                  selected={selectedTab}
                  onSelect={handleTabChange}
                />
                <Button
                  onClick={() => revalidator.revalidate()}
                  loading={revalidator.state === "loading"}
                  size="slim"
                >
                  {revalidator.state === "loading" ? "Syncing..." : "Sync Now"}
                </Button>
              </InlineStack>
            </Box>

            {products.length === 0 ? (
              <Box padding="400">
                <Banner tone="success">
                  <p>
                    {filter === "missing"
                      ? "No products with missing meta descriptions."
                      : filter === "too-long"
                      ? "No products with meta descriptions over 155 characters."
                      : "No products found."}
                  </p>
                </Banner>
              </Box>
            ) : (
              <IndexTable
                resourceName={resourceName}
                itemCount={products.length}
                headings={[
                  { title: "Product" },
                  { title: "Meta Description" },
                  { title: "Status" },
                  { title: "Actions" },
                ]}
                selectable={false}
              >
                {products.map((product, index) => {
                  const draft = drafts[product.id] ?? product.metaDescription;
                  const charCount = draft.length;
                  const isOverLimit = charCount > MAX_META_LENGTH;
                  const isSaving = savingId === product.id;
                  const isSaved = savedIds.has(product.id);
                  const productError = errors[product.id];

                  return (
                    <IndexTable.Row
                      id={product.id}
                      key={product.id}
                      position={index}
                    >
                      {/* Product name */}
                      <IndexTable.Cell>
                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                          {product.title.length > 30
                            ? product.title.slice(0, 30) + "..."
                            : product.title}
                        </Text>
                      </IndexTable.Cell>

                      {/* Editable meta description */}
                      <IndexTable.Cell>
                        <Box minWidth="320px">
                          <BlockStack gap="100">
                            <TextField
                              label=""
                              labelHidden
                              value={draft}
                              onChange={(val) =>
                                handleDraftChange(product.id, val)
                              }
                              multiline={2}
                              autoComplete="off"
                              maxLength={200}
                              placeholder="Enter meta description..."
                              error={
                                isOverLimit
                                  ? `${charCount}/${MAX_META_LENGTH} — too long`
                                  : productError
                              }
                            />
                            <Text
                              as="span"
                              variant="bodySm"
                              tone={isOverLimit ? "critical" : "subdued"}
                            >
                              {charCount}/{MAX_META_LENGTH}
                            </Text>
                          </BlockStack>
                        </Box>
                      </IndexTable.Cell>

                      {/* Status badge */}
                      <IndexTable.Cell>
                        {getStatusBadge(product.status, draft)}
                      </IndexTable.Cell>

                      {/* Actions */}
                      <IndexTable.Cell>
                        <Button
                          size="slim"
                          variant="primary"
                          onClick={() => handleSave(product.id)}
                          loading={isSaving && fetcher.state !== "idle"}
                          disabled={isOverLimit || charCount === 0}
                        >
                          {isSaved ? "Saved ✓" : "Save"}
                        </Button>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  );
                })}
              </IndexTable>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <Box padding="400">
                <InlineStack align="center" gap="200">
                  <Pagination
                    hasPrevious={currentPage > 1}
                    hasNext={currentPage < totalPages}
                    onPrevious={() => handlePageChange("previous")}
                    onNext={() => handlePageChange("next")}
                  />
                  <Text as="span" variant="bodySm" tone="subdued">
                    Page {currentPage} of {totalPages} · {totalProducts} products
                  </Text>
                </InlineStack>
              </Box>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
