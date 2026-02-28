import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    // The admin context isn't returned if the webhook fired after a shop was uninstalled.
    throw new Response();
  }

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        // Clean up store data
        const store = await prisma.store.findUnique({
          where: { shop },
        });

        if (store) {
          // Delete all related data
          await prisma.sEOScan.deleteMany({ where: { storeId: store.id } });
          await prisma.blogPost.deleteMany({ where: { storeId: store.id } });
          await prisma.brokenLink.deleteMany({ where: { storeId: store.id } });
          await prisma.imageOptimization.deleteMany({ where: { storeId: store.id } });
          await prisma.metaTag.deleteMany({ where: { storeId: store.id } });
          await prisma.structuredData.deleteMany({ where: { storeId: store.id } });
          await prisma.keywordResearch.deleteMany({ where: { storeId: store.id } });
          await prisma.speedOptimization.deleteMany({ where: { storeId: store.id } });
          await prisma.altTextOptimization.deleteMany({ where: { storeId: store.id } });
          await prisma.store.delete({ where: { id: store.id } });
        }

        await prisma.session.deleteMany({ where: { shop } });
      }
      break;

    case "PRODUCTS_UPDATE":
      // Handle product updates - could trigger re-optimization
      console.log("Product updated:", payload);
      break;

    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
      // Handle GDPR webhooks
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};
