import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  Page,
  Layout,
  Card,
  Button,
  TextField,
  Select,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Banner,
  Divider,
  Box,
  ButtonGroup,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

// ─── Loader ──────────────────────────────────────────────────────────────────
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const offers = await prisma.quantityOffer.findMany({
    where: { shop: session.shop },
    orderBy: { sortOrder: "asc" },
  });
  return json({ offers });
};

// ─── Action ──────────────────────────────────────────────────────────────────
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const fd = await request.formData();
  const intent = fd.get("intent") as string;

  if (intent === "create") {
    const last = await prisma.quantityOffer.findFirst({
      where: { shop: session.shop },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const isFirstDefault =
      (await prisma.quantityOffer.count({ where: { shop: session.shop } })) ===
      0;

    await prisma.quantityOffer.create({
      data: {
        shop: session.shop,
        quantity: parseInt(fd.get("quantity") as string) || 1,
        label: (fd.get("label") as string) || "1 Item",
        badgeText: (fd.get("badgeText") as string) || null,
        discountType: (fd.get("discountType") as string) || "none",
        discountValue: parseFloat(fd.get("discountValue") as string) || 0,
        isDefault: fd.get("isDefault") === "true" || isFirstDefault,
        isEnabled: true,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    return json({ ok: true });
  }

  if (intent === "delete") {
    await prisma.quantityOffer.delete({
      where: { id: fd.get("id") as string, shop: session.shop },
    });
    return json({ ok: true });
  }

  if (intent === "toggle") {
    const o = await prisma.quantityOffer.findUnique({
      where: { id: fd.get("id") as string },
    });
    await prisma.quantityOffer.update({
      where: { id: fd.get("id") as string, shop: session.shop },
      data: { isEnabled: !o?.isEnabled },
    });
    return json({ ok: true });
  }

  if (intent === "setDefault") {
    await prisma.quantityOffer.updateMany({
      where: { shop: session.shop },
      data: { isDefault: false },
    });
    await prisma.quantityOffer.update({
      where: { id: fd.get("id") as string, shop: session.shop },
      data: { isDefault: true },
    });
    return json({ ok: true });
  }

  if (intent === "moveUp" || intent === "moveDown") {
    const offers = await prisma.quantityOffer.findMany({
      where: { shop: session.shop },
      orderBy: { sortOrder: "asc" },
    });
    const idx = offers.findIndex((o) => o.id === fd.get("id"));
    const swapIdx = intent === "moveUp" ? idx - 1 : idx + 1;
    if (idx >= 0 && swapIdx >= 0 && swapIdx < offers.length) {
      await prisma.quantityOffer.update({
        where: { id: offers[idx].id },
        data: { sortOrder: offers[swapIdx].sortOrder },
      });
      await prisma.quantityOffer.update({
        where: { id: offers[swapIdx].id },
        data: { sortOrder: offers[idx].sortOrder },
      });
    }
    return json({ ok: true });
  }

  return json({ ok: false });
};

// ─── Component ───────────────────────────────────────────────────────────────
type Offer = {
  id: string;
  quantity: number;
  label: string;
  badgeText: string | null;
  discountType: string;
  discountValue: number;
  isDefault: boolean;
  isEnabled: boolean;
  sortOrder: number;
};

const discountOptions = [
  { label: "No Discount (original price × qty)", value: "none" },
  { label: "Percentage Off (%)", value: "percentage" },
  { label: "Fixed Total Price", value: "fixed" },
];

export default function OffersPage() {
  const { offers } = useLoaderData<{ offers: Offer[] }>();
  const fetcher = useFetcher();
  const nav = useNavigation();
  const saving = nav.state === "submitting";

  // Form state
  const [qty, setQty] = useState("1");
  const [label, setLabel] = useState("");
  const [badge, setBadge] = useState("");
  const [discType, setDiscType] = useState("none");
  const [discVal, setDiscVal] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const resetForm = () => {
    setQty("1");
    setLabel("");
    setBadge("");
    setDiscType("none");
    setDiscVal("");
    setIsDefault(false);
  };

  const handleAdd = useCallback(() => {
    fetcher.submit(
      {
        intent: "create",
        quantity: qty,
        label,
        badgeText: badge,
        discountType: discType,
        discountValue: discVal || "0",
        isDefault: String(isDefault),
      },
      { method: "POST" }
    );
    resetForm();
  }, [qty, label, badge, discType, discVal, isDefault, fetcher]);

  const act = (data: Record<string, string>) =>
    fetcher.submit(data, { method: "POST" });

  return (
    <Page
      title="Quantity Offers"
      subtitle="Configure offer cards shown in the COD popup for customers to select"
    >
      <Layout>
        <Layout.Section>
          <Banner title="How it works" tone="info">
            <Text as="p" variant="bodyMd">
              Customers will see selectable offer cards (e.g. "Buy 2 – Save 20%") in the
              popup. Selecting a card auto-updates the quantity and total price before they
              confirm the order.
            </Text>
          </Banner>
        </Layout.Section>

        {/* ── Add offer form ── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Add New Offer
              </Text>
              <InlineStack gap="300" wrap>
                <div style={{ width: 80 }}>
                  <TextField
                    label="Qty"
                    type="number"
                    min={1}
                    value={qty}
                    onChange={setQty}
                    autoComplete="off"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <TextField
                    label="Label"
                    value={label}
                    onChange={setLabel}
                    placeholder="e.g. 2 Items – Popular"
                    autoComplete="off"
                  />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <TextField
                    label="Badge (optional)"
                    value={badge}
                    onChange={setBadge}
                    placeholder="e.g. SAVE 20%"
                    autoComplete="off"
                  />
                </div>
              </InlineStack>
              <InlineStack gap="300" wrap>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <Select
                    label="Discount Type"
                    options={discountOptions}
                    value={discType}
                    onChange={setDiscType}
                  />
                </div>
                {discType !== "none" && (
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <TextField
                      label={
                        discType === "percentage"
                          ? "Discount %"
                          : "Fixed Total Price"
                      }
                      type="number"
                      min={0}
                      value={discVal}
                      onChange={setDiscVal}
                      placeholder={discType === "percentage" ? "20" : "47.99"}
                      autoComplete="off"
                      prefix={discType === "fixed" ? "$" : undefined}
                      suffix={discType === "percentage" ? "%" : undefined}
                    />
                  </div>
                )}
                <div style={{ paddingTop: 24 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                    />
                    <Text as="span" variant="bodyMd">Default selected</Text>
                  </label>
                </div>
              </InlineStack>
              <Box>
                <Button
                  variant="primary"
                  onClick={handleAdd}
                  disabled={!label || saving}
                  loading={fetcher.state === "submitting"}
                >
                  Add Offer
                </Button>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* ── Offer list ── */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Your Offers ({offers.length})
              </Text>

              {offers.length === 0 && (
                <Text as="p" variant="bodyMd" tone="subdued">
                  No offers yet. Add your first offer above.
                </Text>
              )}

              {offers.map((o, i) => (
                <div key={o.id}>
                  {i > 0 && <Divider />}
                  <Box paddingBlockStart="300">
                    <InlineStack gap="300" align="space-between" wrap blockAlign="center">
                      {/* Info */}
                      <BlockStack gap="100">
                        <InlineStack gap="200" blockAlign="center">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">
                            {o.label}
                          </Text>
                          {o.badgeText && (
                            <Badge tone="attention">{o.badgeText}</Badge>
                          )}
                          {o.isDefault && <Badge tone="success">Default</Badge>}
                          {!o.isEnabled && <Badge tone="warning">Disabled</Badge>}
                        </InlineStack>
                        <Text as="span" variant="bodySm" tone="subdued">
                          Qty: {o.quantity} ·{" "}
                          {o.discountType === "none"
                            ? "No discount"
                            : o.discountType === "percentage"
                            ? `${o.discountValue}% off`
                            : `Fixed $${o.discountValue}`}
                        </Text>
                      </BlockStack>

                      {/* Actions */}
                      <ButtonGroup>
                        <Button
                          size="slim"
                          onClick={() => act({ intent: "moveUp", id: o.id })}
                          disabled={i === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          size="slim"
                          onClick={() => act({ intent: "moveDown", id: o.id })}
                          disabled={i === offers.length - 1}
                        >
                          ↓
                        </Button>
                        <Button
                          size="slim"
                          onClick={() => act({ intent: "toggle", id: o.id })}
                        >
                          {o.isEnabled ? "Disable" : "Enable"}
                        </Button>
                        {!o.isDefault && (
                          <Button
                            size="slim"
                            onClick={() => act({ intent: "setDefault", id: o.id })}
                          >
                            Set Default
                          </Button>
                        )}
                        <Button
                          size="slim"
                          tone="critical"
                          onClick={() => act({ intent: "delete", id: o.id })}
                        >
                          Delete
                        </Button>
                      </ButtonGroup>
                    </InlineStack>
                  </Box>
                </div>
              ))}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
