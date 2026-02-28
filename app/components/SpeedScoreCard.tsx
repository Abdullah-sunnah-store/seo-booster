import { Card, Text, BlockStack, InlineStack, Badge, Button, Box, Divider } from "@shopify/polaris";

interface SpeedScoreCardProps {
  mobileScore: number;
  desktopScore: number;
  loadingSpeed?: number;
  totalBlockingTime?: number;
  visualStability?: number;
  interactivity?: number;
  onImprove?: () => void;
  onRecheck?: () => void;
}

export function SpeedScoreCard({
  mobileScore,
  desktopScore,
  loadingSpeed,
  totalBlockingTime,
  visualStability,
  interactivity,
  onImprove,
  onRecheck,
}: SpeedScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return "#22c55e";
    if (score >= 50) return "#f59e0b";
    return "#ef4444";
  };

  const ScoreCircle = ({ score, label }: { score: number; label: string }) => (
    <BlockStack align="center" gap="200">
      <div
        style={{
          width: "100px",
          height: "100px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          border: `6px solid ${getScoreColor(score)}`,
          backgroundColor: "white",
        }}
      >
        <Text as="span" variant="headingXl" fontWeight="bold">
          {score}
        </Text>
      </div>
      <Text as="span" variant="bodySm" tone="subdued">
        {label}
      </Text>
    </BlockStack>
  );

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <Text as="h2" variant="headingMd">
            PageSpeed Score
          </Text>
          {onRecheck && (
            <Button variant="plain" onClick={onRecheck}>
              Recheck
            </Button>
          )}
        </InlineStack>

        <InlineStack gap="800" align="center" blockAlign="center">
          <ScoreCircle score={mobileScore} label="Mobile" />
          <ScoreCircle score={desktopScore} label="Desktop" />
        </InlineStack>

        <Divider />

        <BlockStack gap="300">
          <InlineStack align="space-between">
            <Text as="span" variant="bodySm">Loading speed</Text>
            <Text as="span" variant="bodySm" fontWeight="semibold">
              {loadingSpeed ? `${loadingSpeed}s` : "--"}
            </Text>
          </InlineStack>
          <InlineStack align="space-between">
            <Text as="span" variant="bodySm">Total Blocking Time</Text>
            <Text as="span" variant="bodySm" fontWeight="semibold">
              {totalBlockingTime !== undefined ? `${totalBlockingTime} ms` : "--"}
            </Text>
          </InlineStack>
          <InlineStack align="space-between">
            <Text as="span" variant="bodySm">Visual stability</Text>
            <Text as="span" variant="bodySm" fontWeight="semibold">
              {visualStability !== undefined ? visualStability.toFixed(3) : "--"}
            </Text>
          </InlineStack>
          <InlineStack align="space-between">
            <Text as="span" variant="bodySm">Interactivity</Text>
            <Text as="span" variant="bodySm" fontWeight="semibold">
              {interactivity !== undefined ? `${interactivity} ms` : "--"}
            </Text>
          </InlineStack>
        </BlockStack>

        {onImprove && (
          <Button variant="primary" onClick={onImprove} fullWidth>
            Improve it
          </Button>
        )}
      </BlockStack>
    </Card>
  );
}
