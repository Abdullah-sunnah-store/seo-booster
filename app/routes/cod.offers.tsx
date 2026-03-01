import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  const offers = await prisma.quantityOffer.findMany({
    where: { shop: session.shop, isEnabled: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      quantity: true,
      label: true,
      badgeText: true,
      discountType: true,
      discountValue: true,
      isDefault: true,
    },
  });

  return json(
    { offers },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
};
