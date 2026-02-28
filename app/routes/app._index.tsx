import {
  Page,
  Layout,
  Card,
  Text,
  Banner,
  BlockStack,
  InlineStack,
  Badge,
  List,
} from "@shopify/polaris";

export default function Dashboard() {
  return (
    <Page title="COD Checkout">
      <Layout>
        <Layout.Section>
          <Banner title="How to add the COD button to your store" tone="info">
            <List type="number">
              <List.Item>
                Go to <strong>Online Store → Themes</strong> in your Shopify admin
              </List.Item>
              <List.Item>
                Click <strong>Customize</strong> on your active theme
              </List.Item>
              <List.Item>
                Navigate to a <strong>Product page</strong> template
              </List.Item>
              <List.Item>
                Click <strong>Add block</strong> and select{" "}
                <strong>COD Checkout Button</strong> under Apps
              </List.Item>
              <List.Item>
                Customize button text, colors, and labels — then save
              </List.Item>
            </List>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                How it works
              </Text>
              <InlineStack gap="200" wrap>
                <Badge tone="success">COD Orders</Badge>
                <Badge tone="success">Shopify Order Integration</Badge>
                <Badge tone="success">Customizable Button</Badge>
                <Badge tone="success">Mobile Friendly</Badge>
              </InlineStack>
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  <strong>1. Customer clicks the COD button</strong> on your product page.
                </Text>
                <Text as="p" variant="bodyMd">
                  <strong>2. A popup appears</strong> asking for Name, Phone, Address, and Quantity.
                </Text>
                <Text as="p" variant="bodyMd">
                  <strong>3. On submit</strong>, the order is automatically created in your{" "}
                  <strong>Shopify Orders</strong> section, tagged as <em>COD</em>.
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
