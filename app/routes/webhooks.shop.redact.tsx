import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Triggered 48 days after a shop uninstalls. Delete all shop data.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  await Promise.all([
    db.session.deleteMany({ where: { shop } }),
    db.adSlot.deleteMany({ where: { shop } }),
    db.campaign.deleteMany({ where: { shop } }),
    db.gamConnection.deleteMany({ where: { shop } }),
  ]);

  return new Response();
};
