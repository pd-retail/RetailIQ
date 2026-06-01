import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    appHost: process.env.SHOPIFY_APP_URL?.replace("https://", "") ?? "",
  };
};

export default function App() {
  const { apiKey, appHost } = useLoaderData<typeof loader>();
  return (
    <AppProvider embedded apiKey={apiKey}>
      <PolarisProvider i18n={enTranslations}>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__RETAILIQ_HOST__ = "${appHost}"`,
          }}
        />
        <s-app-nav>
          <s-link href="/app">Home</s-link>
          <s-link href="/app/slots">Ad Slots</s-link>
          <s-link href="/app/products">Product Feed</s-link>
          <s-link href="/app/banners">Banners</s-link>
          <s-link href="/app/reports">Reports</s-link>
          <s-link href="/app/settings">Settings</s-link>
        </s-app-nav>
        <Outlet />
      </PolarisProvider>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};