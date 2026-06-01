import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url    = new URL(request.url);
  const shop   = url.searchParams.get("shop");
  const slotId = url.searchParams.get("slotId");

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (!shop || !slotId) {
    return new Response(JSON.stringify({ error: "Missing params." }), { status: 400, headers });
  }

  const [campaign, slot] = await Promise.all([
    db.campaign.findFirst({
      where: { shop, slotId, status: "active" },
      orderBy: { createdAt: "desc" },
    }),
    db.adSlot.findUnique({ where: { id: slotId } }),
  ]);

  if (!campaign) {
    return new Response(JSON.stringify({ error: "No active campaign." }), { status: 404, headers });
  }

  const appHost  = url.origin;
  const bannerUrl = campaign.bannerUrl
    ? `${appHost}${campaign.bannerUrl}`
    : null;

  return new Response(
    JSON.stringify({
      bannerUrl,
      productUrl:    campaign.productUrl,
      productTitle:  campaign.productTitle,
      gamAdUnitCode: slot?.gamAdUnitCode ?? null,
      gamNetworkCode: process.env.GAM_NETWORK_CODE ?? null,
      width:  slot?.width  ?? null,
      height: slot?.height ?? null,
    }),
    { status: 200, headers }
  );
}