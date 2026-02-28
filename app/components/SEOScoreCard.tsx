import { Card, Text, ProgressBar, BlockStack, InlineStack, Badge, Box } from "@shopify/polaris";

interface SEOScoreCardProps {
  score: number;
  title?: string;
  lastScan?: string;
  criticalIssues?: number;
  improvements?: number;
  goodResults?: number;
  showDetails?: boolean;
}

export function SEOScoreCard({
  score,
  title = "SEO Score",
  lastScan,
  criticalIssues = 0,
  improvements = 0,
  goodResults = 0,
  showDetails = true,
}: SEOScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "success";
    if (score >= 50) return "warning";
    return "critical";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Good";
    if (score >= 50) return "Medium";
    return "Poor";
  };

  const scoreColor = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">{title}</Text>

        <InlineStack align="center" gap="400">
          <Box
            background={scoreColor === "success" ? "bg-fill-success" : scoreColor === "warning" ? "bg-fill-warning" : "bg-fill-critical"}
            borderRadius="full"
            padding="800"
          >
            <div style={{
              width: "120px",
              height: "120px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              border: `8px solid ${scoreColor === "success" ? "#22c55e" : scoreColor === "warning" ? "#f59e0b" : "#ef4444"}`,
              backgroundColor: "white"
            }}>
              <BlockStack align="center">
                <Text as="span" variant="heading2xl" fontWeight="bold">{score}</Text>
              </BlockStack>
            </div>
          </Box>

          <BlockStack gap="200">
            <InlineStack gap="200" align="center">
              <Text as="span" variant="bodyMd">Your score is</Text>
              <Badge tone={scoreColor}>{scoreLabel}</Badge>
            </InlineStack>
            {lastScan && (
              <Text as="span" variant="bodySm" tone="subdued">
                Last scan: {lastScan}
              </Text>
            )}
          </BlockStack>
        </InlineStack>

        {showDetails && (
          <BlockStack gap="200">
            <InlineStack gap="400">
              <InlineStack gap="100">
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#ef4444" }} />
                <Text as="span" variant="bodySm">{criticalIssues} Critical issues</Text>
              </InlineStack>
              <InlineStack gap="100">
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#f59e0b" }} />
                <Text as="span" variant="bodySm">{improvements} Needs improvement</Text>
              </InlineStack>
              <InlineStack gap="100">
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#22c55e" }} />
                <Text as="span" variant="bodySm">{goodResults} Good results</Text>
              </InlineStack>
            </InlineStack>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
