import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// Shopify requires this endpoint but RetailIQ stores no customer PII —
// all data is keyed by shop, not by customer ID.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  return new Response();
};
