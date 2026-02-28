import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Collapsible,
  Icon,
  Box,
  Divider,
} from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon, AlertTriangleIcon, InfoIcon, CheckCircleIcon } from "@shopify/polaris-icons";
import { useState } from "react";

export interface Issue {
  id: string;
  type: "critical" | "warning" | "info" | "success";
  category: string;
  title: string;
  description: string;
  affectedPages?: number;
  fixable?: boolean;
  onFix?: () => void;
}

interface IssuesListProps {
  issues: Issue[];
  title?: string;
  showCategories?: boolean;
}

export function IssuesList({ issues, title = "Issues", showCategories = true }: IssuesListProps) {
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  const toggleIssue = (id: string) => {
    const newExpanded = new Set(expandedIssues);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIssues(newExpanded);
  };

  const getIssueIcon = (type: Issue["type"]) => {
    switch (type) {
      case "critical":
        return AlertTriangleIcon;
      case "warning":
        return InfoIcon;
      case "success":
        return CheckCircleIcon;
      default:
        return InfoIcon;
    }
  };

  const getIssueBadgeTone = (type: Issue["type"]) => {
    switch (type) {
      case "critical":
        return "critical";
      case "warning":
        return "warning";
      case "success":
        return "success";
      default:
        return "info";
    }
  };

  const criticalIssues = issues.filter((i) => i.type === "critical");
  const warningIssues = issues.filter((i) => i.type === "warning");
  const successIssues = issues.filter((i) => i.type === "success");

  const renderIssue = (issue: Issue) => (
    <Box key={issue.id} paddingBlockStart="300" paddingBlockEnd="300">
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Icon source={getIssueIcon(issue.type)} tone={issue.type === "critical" ? "critical" : issue.type === "warning" ? "caution" : "success"} />
            <BlockStack gap="100">
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {issue.title}
              </Text>
              {issue.affectedPages !== undefined && (
                <Text as="span" variant="bodySm" tone="subdued">
                  {issue.affectedPages} pages affected
                </Text>
              )}
            </BlockStack>
          </InlineStack>
          <InlineStack gap="200">
            {issue.fixable && issue.onFix && (
              <Button size="slim" onClick={issue.onFix}>
                Fix
              </Button>
            )}
            <Button
              variant="plain"
              icon={expandedIssues.has(issue.id) ? ChevronUpIcon : ChevronDownIcon}
              onClick={() => toggleIssue(issue.id)}
              accessibilityLabel="Toggle details"
            />
          </InlineStack>
        </InlineStack>

        <Collapsible
          open={expandedIssues.has(issue.id)}
          id={`issue-${issue.id}`}
          transition={{ duration: "200ms", timingFunction: "ease-in-out" }}
        >
          <Box paddingBlockStart="200" paddingInlineStart="600">
            <Text as="p" variant="bodySm" tone="subdued">
              {issue.description}
            </Text>
          </Box>
        </Collapsible>
      </BlockStack>
      <Box paddingBlockStart="300">
        <Divider />
      </Box>
    </Box>
  );

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          {title}
        </Text>

        {showCategories ? (
          <BlockStack gap="400">
            {criticalIssues.length > 0 && (
              <BlockStack gap="200">
                <InlineStack gap="200">
                  <Badge tone="critical">Critical Issues</Badge>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {criticalIssues.length}
                  </Text>
                </InlineStack>
                {criticalIssues.map(renderIssue)}
              </BlockStack>
            )}

            {warningIssues.length > 0 && (
              <BlockStack gap="200">
                <InlineStack gap="200">
                  <Badge tone="warning">Needs Improvement</Badge>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {warningIssues.length}
                  </Text>
                </InlineStack>
                {warningIssues.map(renderIssue)}
              </BlockStack>
            )}

            {successIssues.length > 0 && (
              <BlockStack gap="200">
                <InlineStack gap="200">
                  <Badge tone="success">Good Results</Badge>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {successIssues.length}
                  </Text>
                </InlineStack>
                {successIssues.map(renderIssue)}
              </BlockStack>
            )}
          </BlockStack>
        ) : (
          <BlockStack gap="200">{issues.map(renderIssue)}</BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
