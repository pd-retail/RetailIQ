import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { OAuth2Client } from "google-auth-library";
import {
  Page, Layout, Card, Button, BlockStack,
  Text, Badge, InlineStack, Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const connection = await db.gamConnection.findUnique({
    where: { shop: session.shop },
  });

  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.SHOPIFY_APP_URL}/auth/google/callback`
  );

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/dfp"],
    state: session.shop,
    prompt: "consent",
  });

  const url = new URL(request.url);
  const success = url.searchParams.get("success");
  const error   = url.searchParams.get("error");

  return {
    connected: !!connection,
    networkCode: connection?.networkCode ?? null,
    authUrl,
    success,
    error,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  if (formData.get("intent") === "disconnect") {
    await db.gamConnection.deleteMany({ where: { shop: session.shop } });
  }
  return { success: "disconnected" };
}

export default function SettingsPage() {
  const { connected, networkCode, authUrl, success, error } =
    useLoaderData<typeof loader>();

  return (
    <Page title="Settings" subtitle="Manage your RetailIQ integrations.">
      <Layout>
        {success === "connected" && (
          <Layout.Section>
            <Banner tone="success">Google Ad Manager connected successfully.</Banner>
          </Layout.Section>
        )}
        {error && (
          <Layout.Section>
            <Banner tone="critical">Connection failed. Please try again.</Banner>
          </Layout.Section>
        )}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text variant="headingMd" as="h2">Google Ad Manager</Text>
                  <Text variant="bodySm" tone="subdued" as="p">
                    Connect your GAM account to enable ad delivery, impression
                    tracking, and creative management.
                  </Text>
                </BlockStack>
                <Badge tone={connected ? "success" : "enabled"}>
                  {connected ? "Connected" : "Not connected"}
                </Badge>
              </InlineStack>

              {connected ? (
                <BlockStack gap="200">
                  <Text variant="bodySm" as="p">
                    Network code: <strong>{networkCode}</strong>
                  </Text>
                  <form method="post">
                    <input type="hidden" name="intent" value="disconnect" />
                    <Button submit tone="critical" size="slim">
                      Disconnect
                    </Button>
                  </form>
                </BlockStack>
              ) : (
                <Button onClick={() => { window.top!.location.href = authUrl; }} variant="primary">
              Connect Google Ad Manager
              </Button>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}