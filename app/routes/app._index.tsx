import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [campaignCount, slotCount, gamConnection] = await Promise.all([
    db.campaign.count({ where: { shop } }),
    db.adSlot.count({ where: { shop } }),
    db.gamConnection.findUnique({ where: { shop } }),
  ]);

  return {
    shop,
    campaignCount,
    slotCount,
    gamConnected: !!gamConnection,
    themeEditorUrl: `https://${shop}/admin/themes/current/editor?context=apps`,
  };
};

export default function Index() {
  const { campaignCount, slotCount, gamConnected, themeEditorUrl } =
    useLoaderData<typeof loader>();

  const steps = [
    {
      number: "1",
      title: "Connect Google Ad Manager",
      description:
        "Go to Settings and connect your GAM account. This allows RetailIQ to create and serve banner ads on your storefront.",
      status: gamConnected ? "complete" : "action",
      actionLabel: gamConnected ? "Connected ✓" : "Go to Settings",
      actionHref: "/app/settings",
      complete: gamConnected,
    },
    {
      number: "2",
      title: "Create an Ad Slot",
      description:
        "Ad slots define where banners appear on your storefront. Create at least one slot and copy its Slot ID.",
      status: slotCount > 0 ? "complete" : "action",
      actionLabel: slotCount > 0 ? `${slotCount} slot(s) created ✓` : "Create Ad Slot",
      actionHref: "/app/slots",
      complete: slotCount > 0,
    },
    {
      number: "3",
      title: "Create a Banner Campaign",
      description:
        "Set up your first sponsored banner. Choose a product, ad size, and your campaign will be served through Google Ad Manager.",
      status: campaignCount > 0 ? "complete" : "action",
      actionLabel: campaignCount > 0 ? `${campaignCount} campaign(s) active ✓` : "Create Campaign",
      actionHref: "/app/banners",
      complete: campaignCount > 0,
    },
    {
      number: "4",
      title: "Add the Banner Block to Your Theme",
      description:
        "Open the theme editor, click '+ Add block', find 'RetailIQ Banner', and paste your Slot ID from Step 2 into the block settings.",
      status: "action",
      actionLabel: "Open Theme Editor",
      actionHref: themeEditorUrl,
      external: true,
      complete: false,
    },
  ];

  return (
    <s-page heading="RetailIQ Media — Setup Guide">
      <s-section heading="Welcome to RetailIQ">
        <s-paragraph>
          Follow these four steps to start serving sponsored banner ads on your
          storefront and earning revenue from your suppliers.
        </s-paragraph>
      </s-section>

      {steps.map((step) => (
        <s-section
          key={step.number}
          heading={`Step ${step.number}: ${step.title}`}
        >
          <s-paragraph>{step.description}</s-paragraph>
          <s-stack direction="inline" gap="base">
            {step.complete ? (
              <s-badge tone="success">{step.actionLabel}</s-badge>
            ) : (
              <s-button
                href={step.actionHref}
                {...(step.external ? { target: "_blank" } : {})}
                variant={step.number === "4" ? "primary" : "secondary"}
              >
                {step.actionLabel}
              </s-button>
            )}
          </s-stack>
        </s-section>
      ))}

      <s-section slot="aside" heading="Quick Stats">
        <s-paragraph>
          <s-text>Ad Slots: </s-text>
          <s-text>{slotCount}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Campaigns: </s-text>
          <s-text>{campaignCount}</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>GAM Connected: </s-text>
          <s-text>{gamConnected ? "Yes ✓" : "Not yet"}</s-text>
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Theme Extension Instructions">
        <s-paragraph>
          To add a banner to your store:
        </s-paragraph>
        <s-ordered-list>
          <s-list-item>Open the Theme Editor (Step 4 above)</s-list-item>
          <s-list-item>Click on a section where you want the banner</s-list-item>
          <s-list-item>Click <s-text variant="strong">+ Add block</s-text></s-list-item>
          <s-list-item>Select <s-text variant="strong">RetailIQ Banner</s-text></s-list-item>
          <s-list-item>Paste your Slot ID from Ad Slots</s-list-item>
          <s-list-item>Click Save</s-list-item>
        </s-ordered-list>
        <s-paragraph>
          <s-link href="/app/slots">View your Slot IDs →</s-link>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
