import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Button,
  InlineStack,
  BlockStack,
  Box,
  Banner,
  Collapsible,
  List,
  Divider,
  ProgressBar,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";

// ─── Types ───────────────────────────────────────────────────────────────────

type CheckStatus = "pass" | "fail" | "warning";

interface CheckItem {
  id: string;
  title: string;
  category: string;
  status: CheckStatus;
  message: string;
  affectedItems?: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function countH1Tags(html: string): number {
  return (html.match(/<h1[^>]*>/gi) || []).length;
}

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const shopUrl = `https://${shop}`;
  const checks: CheckItem[] = [];

  // ── Fetch ALL products ──────────────────────────────────────────────────────
  type Product = {
    id: string;
    title: string;
    descriptionHtml: string;
    seo: { title: string | null; description: string | null };
    images: { edges: { node: { altText: string | null } }[] };
  };
  const allProducts: Product[] = [];
  let hasNext = true;
  let cursor: string | null = null;

  while (hasNext) {
    const res = await admin.graphql(
      `query GetProducts($cursor: String) {
        products(first: 50, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id title descriptionHtml
              seo { title description }
              images(first: 20) { edges { node { altText } } }
            }
          }
        }
      }`,
      { variables: { cursor } }
    );
    const data = await res.json();
    const page = data.data?.products;
    hasNext = page?.pageInfo?.hasNextPage ?? false;
    cursor = page?.pageInfo?.endCursor ?? null;
    for (const edge of page?.edges ?? []) allProducts.push(edge.node);
  }

  // ── Fetch ALL pages ─────────────────────────────────────────────────────────
  type ShopPage = { id: string; title: string; body: string };
  const allPages: ShopPage[] = [];
  hasNext = true;
  cursor = null;

  while (hasNext) {
    const res = await admin.graphql(
      `query GetPages($cursor: String) {
        pages(first: 50, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges { node { id title body } }
        }
      }`,
      { variables: { cursor } }
    );
    const data = await res.json();
    const page = data.data?.pages;
    hasNext = page?.pageInfo?.hasNextPage ?? false;
    cursor = page?.pageInfo?.endCursor ?? null;
    for (const edge of page?.edges ?? []) allPages.push(edge.node);
  }

  // ── Fetch ALL collections ───────────────────────────────────────────────────
  type Collection = {
    id: string;
    title: string;
    descriptionHtml: string;
    seo: { title: string | null; description: string | null };
  };
  const allCollections: Collection[] = [];
  hasNext = true;
  cursor = null;

  while (hasNext) {
    const res = await admin.graphql(
      `query GetCollections($cursor: String) {
        collections(first: 50, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id title descriptionHtml
              seo { title description }
            }
          }
        }
      }`,
      { variables: { cursor } }
    );
    const data = await res.json();
    const page = data.data?.collections;
    hasNext = page?.pageInfo?.hasNextPage ?? false;
    cursor = page?.pageInfo?.endCursor ?? null;
    for (const edge of page?.edges ?? []) allCollections.push(edge.node);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CONTENT CHECKS
  // ════════════════════════════════════════════════════════════════════════════

  // 1. Multiple H1 in product descriptions
  const multiH1Products = allProducts.filter(
    (p) => countH1Tags(p.descriptionHtml) > 1
  );
  checks.push({
    id: "product-multiple-h1",
    title: "Multiple H1 Tags in Product Descriptions",
    category: "Content",
    status: multiH1Products.length === 0 ? "pass" : "fail",
    message:
      multiH1Products.length === 0
        ? "No products have multiple H1 tags."
        : `${multiH1Products.length} product(s) contain more than one H1 tag. Each page should have exactly one H1.`,
    affectedItems: multiH1Products.map((p) => p.title),
  });

  // 2. Multiple H1 in pages
  const multiH1Pages = allPages.filter((p) => countH1Tags(p.body) > 1);
  checks.push({
    id: "page-multiple-h1",
    title: "Multiple H1 Tags on Pages",
    category: "Content",
    status: multiH1Pages.length === 0 ? "pass" : "fail",
    message:
      multiH1Pages.length === 0
        ? "No pages have multiple H1 tags."
        : `${multiH1Pages.length} page(s) contain more than one H1 tag.`,
    affectedItems: multiH1Pages.map((p) => p.title),
  });

  // 3. Thin content (< 150 chars)
  const thinProducts = allProducts.filter(
    (p) => stripHtml(p.descriptionHtml).length < 150
  );
  checks.push({
    id: "thin-content",
    title: "Thin Product Content (< 150 Characters)",
    category: "Content",
    status:
      thinProducts.length === 0
        ? "pass"
        : thinProducts.length < 5
        ? "warning"
        : "fail",
    message:
      thinProducts.length === 0
        ? "All products have sufficient description content."
        : `${thinProducts.length} product(s) have very short descriptions — thin content can hurt SEO rankings.`,
    affectedItems: thinProducts.slice(0, 30).map((p) => p.title),
  });

  // 4. Duplicate product titles
  const titleMap = new Map<string, number>();
  for (const p of allProducts) {
    const key = p.title.toLowerCase().trim();
    titleMap.set(key, (titleMap.get(key) ?? 0) + 1);
  }
  const dupTitles = [
    ...new Set(
      allProducts
        .filter((p) => (titleMap.get(p.title.toLowerCase().trim()) ?? 0) > 1)
        .map((p) => p.title)
    ),
  ];
  checks.push({
    id: "duplicate-titles",
    title: "Duplicate Product Titles",
    category: "Content",
    status: dupTitles.length === 0 ? "pass" : "warning",
    message:
      dupTitles.length === 0
        ? "No duplicate product titles found."
        : `${dupTitles.length} duplicate product title(s) detected — can cause duplicate content issues.`,
    affectedItems: dupTitles,
  });

  // 5. Collections with no description
  const noDescCollections = allCollections.filter(
    (c) => stripHtml(c.descriptionHtml ?? "").trim().length === 0
  );
  checks.push({
    id: "collection-no-description",
    title: "Collections Without Description",
    category: "Content",
    status: noDescCollections.length === 0 ? "pass" : "warning",
    message:
      noDescCollections.length === 0
        ? "All collections have descriptions."
        : `${noDescCollections.length} collection(s) have no description — missed opportunity for keyword-rich content.`,
    affectedItems: noDescCollections.map((c) => c.title),
  });

  // ════════════════════════════════════════════════════════════════════════════
  // META & SEO CHECKS
  // ════════════════════════════════════════════════════════════════════════════

  // 6. Products missing SEO title
  const missingTitle = allProducts.filter(
    (p) => !p.seo?.title || p.seo.title.trim() === ""
  );
  checks.push({
    id: "missing-seo-title",
    title: "Products Missing SEO Title",
    category: "Meta & SEO",
    status:
      missingTitle.length === 0
        ? "pass"
        : missingTitle.length < 5
        ? "warning"
        : "fail",
    message:
      missingTitle.length === 0
        ? "All products have SEO titles."
        : `${missingTitle.length} product(s) are missing SEO titles — search engines will use the product title as fallback.`,
    affectedItems: missingTitle.slice(0, 30).map((p) => p.title),
  });

  // 7. Products missing meta description
  const missingMeta = allProducts.filter(
    (p) => !p.seo?.description || p.seo.description.trim() === ""
  );
  checks.push({
    id: "missing-meta-description",
    title: "Products Missing Meta Description",
    category: "Meta & SEO",
    status:
      missingMeta.length === 0
        ? "pass"
        : missingMeta.length < 5
        ? "warning"
        : "fail",
    message:
      missingMeta.length === 0
        ? "All products have meta descriptions."
        : `${missingMeta.length} product(s) are missing meta descriptions — Google will auto-generate one, often poorly.`,
    affectedItems: missingMeta.slice(0, 30).map((p) => p.title),
  });

  // 8. Meta description over 155 chars
  const longMeta = allProducts.filter(
    (p) => p.seo?.description && p.seo.description.length > 155
  );
  checks.push({
    id: "meta-too-long",
    title: "Meta Descriptions Over 155 Characters",
    category: "Meta & SEO",
    status: longMeta.length === 0 ? "pass" : "warning",
    message:
      longMeta.length === 0
        ? "All meta descriptions are within the 155-character limit."
        : `${longMeta.length} product(s) have meta descriptions over 155 characters — Google will truncate them.`,
    affectedItems: longMeta
      .slice(0, 30)
      .map((p) => `${p.title} (${p.seo!.description!.length} chars)`),
  });

  // 9. Collections missing meta description
  const collectionNoMeta = allCollections.filter(
    (c) => !c.seo?.description || c.seo.description.trim() === ""
  );
  checks.push({
    id: "collection-missing-meta",
    title: "Collections Missing Meta Description",
    category: "Meta & SEO",
    status: collectionNoMeta.length === 0 ? "pass" : "warning",
    message:
      collectionNoMeta.length === 0
        ? "All collections have meta descriptions."
        : `${collectionNoMeta.length} collection(s) are missing meta descriptions.`,
    affectedItems: collectionNoMeta.map((c) => c.title),
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ACCESSIBILITY CHECKS
  // ════════════════════════════════════════════════════════════════════════════

  // 10. Product images without alt text
  const imagesNoAlt: string[] = [];
  for (const p of allProducts) {
    const bad = p.images.edges.filter(
      (e) => !e.node.altText || e.node.altText.trim() === ""
    );
    if (bad.length > 0)
      imagesNoAlt.push(`${p.title} (${bad.length} image${bad.length > 1 ? "s" : ""})`);
  }
  checks.push({
    id: "missing-alt-text",
    title: "Product Images Missing Alt Text",
    category: "Accessibility",
    status:
      imagesNoAlt.length === 0
        ? "pass"
        : imagesNoAlt.length < 5
        ? "warning"
        : "fail",
    message:
      imagesNoAlt.length === 0
        ? "All product images have alt text."
        : `${imagesNoAlt.length} product(s) have images without alt text — hurts accessibility and image SEO.`,
    affectedItems: imagesNoAlt.slice(0, 30),
  });

  // ════════════════════════════════════════════════════════════════════════════
  // TECHNICAL SEO CHECKS
  // ════════════════════════════════════════════════════════════════════════════

  // 11. Theme.liquid checks
  try {
    const themesRes = await admin.graphql(
      `query { themes(first: 10) { nodes { id name role } } }`
    );
    const themesData = await themesRes.json();
    const mainTheme = themesData.data?.themes?.nodes?.find(
      (t: { role: string }) => t.role === "MAIN"
    );

    if (mainTheme) {
      try {
        const fileRes = await admin.graphql(
          `query GetThemeFile($id: ID!) {
            theme(id: $id) {
              files(filenames: ["layout/theme.liquid"], first: 1) {
                nodes {
                  filename
                  body { ... on OnlineStoreThemeFileBodyText { content } }
                }
              }
            }
          }`,
          { variables: { id: mainTheme.id } }
        );
        const fileData = await fileRes.json();
        const content: string =
          fileData.data?.theme?.files?.nodes?.[0]?.body?.content ?? "";

        if (content) {
          const themeChecks: Array<{
            id: string;
            title: string;
            pattern: RegExp | string;
            failMessage: string;
            passMessage: string;
            severity: CheckStatus;
          }> = [
            {
              id: "theme-canonical",
              title: "Canonical Tag (theme.liquid)",
              pattern: /canonical/i,
              passMessage: "theme.liquid contains a canonical link tag.",
              failMessage:
                "theme.liquid is missing a canonical link tag — can cause duplicate content issues.",
              severity: "fail",
            },
            {
              id: "theme-viewport",
              title: "Viewport Meta Tag (theme.liquid)",
              pattern: /viewport/i,
              passMessage: "theme.liquid has a viewport meta tag.",
              failMessage:
                "theme.liquid is missing viewport meta tag — required for mobile SEO.",
              severity: "fail",
            },
            {
              id: "theme-title-tag",
              title: "Title Tag (theme.liquid)",
              pattern: /<title|title_tag/i,
              passMessage: "theme.liquid outputs a title tag.",
              failMessage:
                "theme.liquid is missing a title tag — critical SEO issue.",
              severity: "fail",
            },
            {
              id: "theme-og-tags",
              title: "Open Graph Tags (theme.liquid)",
              pattern: /og:/i,
              passMessage: "theme.liquid has Open Graph meta tags for social sharing.",
              failMessage:
                "theme.liquid is missing Open Graph tags — affects social media previews.",
              severity: "warning",
            },
            {
              id: "theme-schema",
              title: "Structured Data / Schema Markup (theme.liquid)",
              pattern: /application\/ld\+json|schema\.org/i,
              passMessage: "theme.liquid contains structured data (JSON-LD) markup.",
              failMessage:
                "No structured data found in theme.liquid — add schema.org markup to improve rich results.",
              severity: "warning",
            },
            {
              id: "theme-meta-charset",
              title: "Charset Meta Tag (theme.liquid)",
              pattern: /charset/i,
              passMessage: "theme.liquid declares a charset.",
              failMessage:
                "theme.liquid is missing a charset declaration — required for proper text encoding.",
              severity: "warning",
            },
          ];

          for (const tc of themeChecks) {
            const found =
              tc.pattern instanceof RegExp
                ? tc.pattern.test(content)
                : content.includes(tc.pattern);
            checks.push({
              id: tc.id,
              title: tc.title,
              category: "Technical SEO",
              status: found ? "pass" : tc.severity,
              message: found ? tc.passMessage : tc.failMessage,
            });
          }
        } else {
          checks.push({
            id: "theme-checks",
            title: "Theme.liquid Checks",
            category: "Technical SEO",
            status: "warning",
            message: "theme.liquid content could not be read — theme checks skipped.",
          });
        }
      } catch {
        checks.push({
          id: "theme-checks",
          title: "Theme.liquid Checks",
          category: "Technical SEO",
          status: "warning",
          message: "Could not access theme files — theme checks skipped.",
        });
      }
    }
  } catch {
    // theme query failed silently
  }

  // 12. robots.txt
  try {
    const r = await fetch(`${shopUrl}/robots.txt`, { method: "HEAD" });
    checks.push({
      id: "robots-txt",
      title: "robots.txt Accessible",
      category: "Technical SEO",
      status: r.ok ? "pass" : "fail",
      message: r.ok
        ? "robots.txt is accessible to search engines."
        : `robots.txt returned HTTP ${r.status} — may block crawlers.`,
    });
  } catch {
    checks.push({
      id: "robots-txt",
      title: "robots.txt Accessible",
      category: "Technical SEO",
      status: "warning",
      message: "Could not reach robots.txt.",
    });
  }

  // 13. sitemap.xml
  try {
    const r = await fetch(`${shopUrl}/sitemap.xml`, { method: "HEAD" });
    checks.push({
      id: "sitemap-xml",
      title: "sitemap.xml Accessible",
      category: "Technical SEO",
      status: r.ok ? "pass" : "fail",
      message: r.ok
        ? "sitemap.xml is accessible — search engines can discover all your pages."
        : `sitemap.xml returned HTTP ${r.status} — Google may not index all your pages.`,
    });
  } catch {
    checks.push({
      id: "sitemap-xml",
      title: "sitemap.xml Accessible",
      category: "Technical SEO",
      status: "warning",
      message: "Could not reach sitemap.xml.",
    });
  }

  // ── Summary stats ──
  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const warnings = checks.filter((c) => c.status === "warning").length;
  const score = Math.round((passed / checks.length) * 100);

  return {
    checks,
    stats: { passed, failed, warnings, total: checks.length, score },
    scannedAt: new Date().toISOString(),
    totals: {
      products: allProducts.length,
      pages: allPages.length,
      collections: allCollections.length,
    },
  };
};

// ─── Component ───────────────────────────────────────────────────────────────

const CATEGORIES = ["Content", "Meta & SEO", "Accessibility", "Technical SEO"];

const STATUS_CONFIG: Record<
  CheckStatus,
  { tone: "success" | "critical" | "warning"; label: string; icon: string }
> = {
  pass: { tone: "success", label: "Pass", icon: "✓" },
  fail: { tone: "critical", label: "Fail", icon: "✕" },
  warning: { tone: "warning", label: "Warning", icon: "!" },
};

export default function SeoChecklist() {
  const { checks, stats, scannedAt, totals } =
    useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const isScanning = revalidator.state === "loading";

  const scoreColor =
    stats.score >= 80 ? "success" : stats.score >= 50 ? "caution" : "critical";

  const formattedDate = new Date(scannedAt).toLocaleString();

  return (
    <Page title="SEO Checklist">
      <Layout>
        <Layout.Section>
          {/* Header controls */}
          <Box paddingBlockEnd="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="p" variant="bodySm" tone="subdued">
                Last scanned: {formattedDate} · {totals.products} products ·{" "}
                {totals.pages} pages · {totals.collections} collections
              </Text>
              <Button
                variant="primary"
                onClick={() => revalidator.revalidate()}
                loading={isScanning}
              >
                {isScanning ? "Scanning..." : "Run Scan"}
              </Button>
            </InlineStack>
          </Box>

          {/* Score + stats */}
          <Box paddingBlockEnd="400">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingLg">
                      SEO Score
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Based on {stats.total} checks across your store
                    </Text>
                  </BlockStack>
                  <Text
                    as="p"
                    variant="heading2xl"
                    tone={scoreColor}
                  >
                    {stats.score}%
                  </Text>
                </InlineStack>
                <ProgressBar
                  progress={stats.score}
                  tone={scoreColor === "caution" ? "highlight" : scoreColor === "critical" ? "critical" : "success"}
                  size="medium"
                />
                <InlineStack gap="400">
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="success">✓ {stats.passed} Passed</Badge>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="critical">✕ {stats.failed} Failed</Badge>
                  </InlineStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="warning">! {stats.warnings} Warnings</Badge>
                  </InlineStack>
                </InlineStack>
              </BlockStack>
            </Card>
          </Box>

          {/* Checks grouped by category */}
          <BlockStack gap="400">
            {CATEGORIES.map((category) => {
              const categoryChecks = checks.filter(
                (c) => c.category === category
              );
              if (categoryChecks.length === 0) return null;

              const catPassed = categoryChecks.filter(
                (c) => c.status === "pass"
              ).length;
              const catFailed = categoryChecks.filter(
                (c) => c.status === "fail"
              ).length;
              const catWarnings = categoryChecks.filter(
                (c) => c.status === "warning"
              ).length;

              return (
                <Card key={category}>
                  <BlockStack gap="400">
                    {/* Category header */}
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        {category}
                      </Text>
                      <InlineStack gap="200">
                        {catPassed > 0 && (
                          <Badge tone="success">{catPassed} passed</Badge>
                        )}
                        {catFailed > 0 && (
                          <Badge tone="critical">{catFailed} failed</Badge>
                        )}
                        {catWarnings > 0 && (
                          <Badge tone="warning">{catWarnings} warnings</Badge>
                        )}
                      </InlineStack>
                    </InlineStack>

                    <Divider />

                    {/* Check items */}
                    <BlockStack gap="300">
                      {categoryChecks.map((check, idx) => {
                        const cfg = STATUS_CONFIG[check.status];
                        const hasDetails =
                          check.affectedItems && check.affectedItems.length > 0;
                        const isOpen = openIds.has(check.id);

                        return (
                          <Box key={check.id}>
                            {idx > 0 && (
                              <Box paddingBlockEnd="300">
                                <Divider borderColor="border-subdued" />
                              </Box>
                            )}
                            <InlineStack
                              align="space-between"
                              blockAlign="start"
                              gap="400"
                            >
                              {/* Left: icon + content */}
                              <InlineStack gap="300" blockAlign="start">
                                {/* Status circle */}
                                <Box
                                  minWidth="28px"
                                  minHeight="28px"
                                  background={
                                    check.status === "pass"
                                      ? "bg-fill-success"
                                      : check.status === "fail"
                                      ? "bg-fill-critical"
                                      : "bg-fill-caution"
                                  }
                                  borderRadius="full"
                                  paddingInline="150"
                                  paddingBlock="050"
                                >
                                  <Text
                                    as="span"
                                    variant="bodyMd"
                                    fontWeight="bold"
                                    tone="text-inverse"
                                  >
                                    {cfg.icon}
                                  </Text>
                                </Box>

                                <BlockStack gap="100">
                                  <Text
                                    as="p"
                                    variant="bodyMd"
                                    fontWeight="semibold"
                                  >
                                    {check.title}
                                  </Text>
                                  <Text
                                    as="p"
                                    variant="bodySm"
                                    tone={
                                      check.status === "pass"
                                        ? "success"
                                        : check.status === "fail"
                                        ? "critical"
                                        : "caution"
                                    }
                                  >
                                    {check.message}
                                  </Text>
                                </BlockStack>
                              </InlineStack>

                              {/* Right: badge + expand */}
                              <InlineStack gap="200" blockAlign="center">
                                <Badge tone={cfg.tone}>{cfg.label}</Badge>
                                {hasDetails && (
                                  <Button
                                    size="slim"
                                    variant="plain"
                                    onClick={() => toggle(check.id)}
                                  >
                                    {isOpen ? "Hide" : `View ${check.affectedItems!.length}`}
                                  </Button>
                                )}
                              </InlineStack>
                            </InlineStack>

                            {/* Collapsible affected items */}
                            {hasDetails && (
                              <Collapsible
                                id={check.id}
                                open={isOpen}
                                transition={{ duration: "150ms" }}
                              >
                                <Box
                                  paddingBlockStart="300"
                                  paddingInlineStart="1000"
                                >
                                  <Box
                                    background="bg-surface-secondary"
                                    borderRadius="200"
                                    padding="300"
                                  >
                                    <BlockStack gap="100">
                                      <Text
                                        as="p"
                                        variant="bodySm"
                                        tone="subdued"
                                        fontWeight="semibold"
                                      >
                                        Affected items ({check.affectedItems!.length})
                                      </Text>
                                      <List type="bullet">
                                        {check.affectedItems!.map((item, i) => (
                                          <List.Item key={i}>
                                            <Text as="span" variant="bodySm">
                                              {item}
                                            </Text>
                                          </List.Item>
                                        ))}
                                      </List>
                                    </BlockStack>
                                  </Box>
                                </Box>
                              </Collapsible>
                            )}
                          </Box>
                        );
                      })}
                    </BlockStack>
                  </BlockStack>
                </Card>
              );
            })}
          </BlockStack>

          {/* Empty state */}
          {checks.length === 0 && (
            <Banner tone="info">
              <p>No checks completed yet. Click Run Scan to analyze your store.</p>
            </Banner>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
