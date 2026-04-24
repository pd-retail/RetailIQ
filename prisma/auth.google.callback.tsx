import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { OAuth2Client } from "google-auth-library";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url   = new URL(request.url);
  const code  = url.searchParams.get("code");
  const shop  = url.searchParams.get("state");

  if (!code || !shop) {
    return redirect("/app/settings?error=missing_params");
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
      create: {
        shop,
        networkCode:  process.env.GAM_NETWORK_CODE!,
        refreshToken: tokens.refresh_token!,
        accessToken:  tokens.access_token ?? null,
        tokenExpiry:  tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
      },
      update: {
        refreshToken: tokens.refresh_token ?? undefined,
        accessToken:  tokens.access_token ?? null,
        tokenExpiry:  tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
      },
    });

    return redirect(
      `https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app/settings?success=connected`
    );
  } catch (e) {
    console.error("GAM OAuth error:", e);
    return redirect("/app/settings?error=oauth_failed");
  }
}

export default function GoogleCallback() {
  return <p>Connecting to Google Ad Manager...</p>;
}