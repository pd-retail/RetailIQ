import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { OAuth2Client } from "google-auth-library";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const shop = url.searchParams.get("state");

  if (!code || !shop) {
    return redirect(`/app/settings?error=missing_params`);
  }

  try {
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.SHOPIFY_APP_URL}/auth/google/callback`
    );

    const { tokens } = await client.getToken(code);

    await db.gamConnection.upsert({
      where: { shop },
      update: {
        refreshToken: tokens.refresh_token ?? "",
        accessToken: tokens.access_token ?? "",
        tokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
        networkCode: process.env.GAM_NETWORK_CODE ?? "",
      },
      create: {
        shop,
        networkCode: process.env.GAM_NETWORK_CODE ?? "",
        refreshToken: tokens.refresh_token ?? "",
        accessToken: tokens.access_token ?? "",
        tokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
      },
    });

    return redirect(
      `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/retailiq_v2/app/settings?success=connected`
    );
  } catch (err) {
    console.error("GAM OAuth error:", err);
    return redirect(
      `https://admin.shopify.com/store/${shop.replace(".myshopify.com", "")}/apps/retailiq_v2/app/settings?error=oauth_failed`
    );
  }
}