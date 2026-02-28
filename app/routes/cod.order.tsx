import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { admin } = await authenticate.public.appProxy(request);

  if (!admin) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name?: string;
    phone?: string;
    address?: string;
    quantity?: number;
    variant_id?: string | number;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, phone, address, quantity, variant_id } = body;

  if (!name || !phone || !address || !variant_id) {
    return json({ error: "Missing required fields" }, { status: 400 });
  }

  const nameParts = String(name).trim().split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || "-";
  const qty = Math.max(1, parseInt(String(quantity)) || 1);

  try {
    // Step 1: Create draft order
    const draftRes = await admin.graphql(
      `#graphql
      mutation DraftOrderCreate($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          input: {
            lineItems: [
              {
                variantId: `gid://shopify/ProductVariant/${variant_id}`,
                quantity: qty,
              },
            ],
            shippingAddress: {
              firstName,
              lastName,
              phone: String(phone),
              address1: String(address),
            },
            billingAddress: {
              firstName,
              lastName,
              phone: String(phone),
              address1: String(address),
            },
            note: "Cash on Delivery (COD)",
            tags: ["COD"],
            customAttributes: [
              { key: "Payment Method", value: "Cash on Delivery" },
            ],
          },
        },
      }
    );

    const draftData = (await draftRes.json()) as {
      data?: {
        draftOrderCreate?: {
          draftOrder?: { id: string };
          userErrors?: { field: string; message: string }[];
        };
      };
    };

    const userErrors = draftData?.data?.draftOrderCreate?.userErrors ?? [];
    if (userErrors.length > 0) {
      return json({ error: userErrors[0].message }, { status: 400 });
    }

    const draftOrderId = draftData?.data?.draftOrderCreate?.draftOrder?.id;
    if (!draftOrderId) {
      return json({ error: "Failed to create draft order" }, { status: 500 });
    }

    // Step 2: Complete draft order → creates real order
    const completeRes = await admin.graphql(
      `#graphql
      mutation DraftOrderComplete($id: ID!) {
        draftOrderComplete(id: $id) {
          draftOrder {
            order {
              id
              name
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      { variables: { id: draftOrderId } }
    );

    const completeData = (await completeRes.json()) as {
      data?: {
        draftOrderComplete?: {
          draftOrder?: { order?: { id: string; name: string } };
          userErrors?: { field: string; message: string }[];
        };
      };
    };

    const completeErrors =
      completeData?.data?.draftOrderComplete?.userErrors ?? [];
    if (completeErrors.length > 0) {
      return json({ error: completeErrors[0].message }, { status: 400 });
    }

    const order =
      completeData?.data?.draftOrderComplete?.draftOrder?.order;

    if (!order) {
      return json({ error: "Failed to complete order" }, { status: 500 });
    }

    return json({ success: true, orderName: order.name, orderId: order.id });
  } catch (err) {
    console.error("COD order error:", err);
    return json(
      { error: "Server error. Please try again." },
      { status: 500 }
    );
  }
};
