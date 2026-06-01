import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Form, useNavigation } from "react-router";
import {
  Page,
  Layout,
  Card,
  Button,
  IndexTable,
  Text,
  BlockStack,
  InlineStack,
  EmptyState,
  Spinner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { fetchGamReport } from "../services/gam.server";

type ReportRow = {
  lineItemId: string;
  lineItemName: string;
  impressions: number;
  clicks: number;
  ctr: number;
  revenue: number;
  campaignName: string;
  productTitle: string;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  if (!startDate || !endDate) {
    return { rows: null, startDate: null, endDate: null };
  }
  const [campaigns, gamRows] = await Promise.all([
    db.campaign.findMany({ where: { shop: session.shop } }),
    fetchGamReport(session.shop, startDate, endDate).catch(() => []),
  ]);
  const rows: ReportRow[] = gamRows.map((row) => {
    const campaign = campaigns.find((c) => c.gamLineItemId === row.lineItemId);
    return {
      ...row,
      campaignName: campaign?.name ?? row.lineItemName,
      productTitle: campaign?.productTitle ?? "",
    };
  });
  return { rows, startDate, endDate };
}

export default function ReportsPage() {
  const { rows, startDate, endDate } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  const today = new Date().toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [start, setStart] = useState(startDate ?? sevenDaysAgo);
  const [end, setEnd] = useState(endDate ?? today);

  const totalImpressions = rows?.reduce((s, r) => s + r.impressions, 0) ?? 0;
  const totalClicks = rows?.reduce((s, r) => s + r.clicks, 0) ?? 0;
  const totalRevenue = rows?.reduce((s, r) => s + r.revenue, 0) ?? 0;
  const overallCtr =
    totalImpressions > 0
      ? ((totalClicks / totalImpressions) * 100).toFixed(2)
      : "0.00";

  return (
    <Page
      title="Reports"
      subtitle="Campaign performance from Google Ad Manager."
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingSm" as="h2">Date range</Text>
              <InlineStack gap="300" blockAlign="end">
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
                    Start date
                  </label>
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    style={{ padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 14 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
                    End date
                  </label>
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    style={{ padding: "6px 8px", border: "1px solid #ccc", borderRadius: 4, fontSize: 14 }}
                  />
                </div>
                <Form method="get">
                  <input type="hidden" name="startDate" value={start} />
                  <input type="hidden" name="endDate" value={end} />
                  <Button submit variant="primary" loading={isLoading}>
                    Run report
                  </Button>
                </Form>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {isLoading && (
          <Layout.Section>
            <Card>
              <InlineStack align="center" gap="300">
                <Spinner size="small" />
                <Text as="p">
                  Fetching report from Google Ad Manager — this may take 10–30 seconds.
                </Text>
              </InlineStack>
            </Card>
          </Layout.Section>
        )}

        {rows && !isLoading && (
          <>
            <Layout.Section>
              <InlineStack gap="400">
                {[
                  { label: "Total impressions", value: totalImpressions.toLocaleString() },
                  { label: "Total clicks", value: totalClicks.toLocaleString() },
                  { label: "Overall CTR", value: `${overallCtr}%` },
                  { label: "Total revenue", value: `$${totalRevenue.toFixed(2)}` },
                ].map(({ label, value }) => (
                  <Card key={label}>
                    <BlockStack gap="100">
                      <Text variant="bodySm" tone="subdued" as="p">{label}</Text>
                      <Text variant="headingLg" as="p">{value}</Text>
                    </BlockStack>
                  </Card>
                ))}
              </InlineStack>
            </Layout.Section>

            <Layout.Section>
              {rows.length === 0 ? (
                <Card>
                  <EmptyState
                    heading="No data for this period"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>No impressions were recorded in the selected date range.</p>
                  </EmptyState>
                </Card>
              ) : (
                <Card padding="0">
                  <IndexTable
                    resourceName={{ singular: "campaign", plural: "campaigns" }}
                    itemCount={rows.length}
                    headings={[
                      { title: "Campaign" },
                      { title: "Product" },
                      { title: "Impressions" },
                      { title: "Clicks" },
                      { title: "CTR" },
                      { title: "Revenue" },
                    ]}
                    selectable={false}
                  >
                    {rows.map((row, index) => (
                      <IndexTable.Row
                        id={row.lineItemId}
                        key={row.lineItemId}
                        position={index}
                      >
                        <IndexTable.Cell>
                          <Text variant="bodyMd" fontWeight="bold" as="span">
                            {row.campaignName}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>{row.productTitle}</IndexTable.Cell>
                        <IndexTable.Cell>
                          {row.impressions.toLocaleString()}
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          {row.clicks.toLocaleString()}
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          {(row.ctr * 100).toFixed(2)}%
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          ${row.revenue.toFixed(2)}
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>
                </Card>
              )}
            </Layout.Section>
          </>
        )}

        {!rows && !isLoading && (
          <Layout.Section>
            <Card>
              <EmptyState
                heading="Select a date range to run a report"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Choose a start and end date above, then click Run report to
                  fetch data from Google Ad Manager.
                </p>
              </EmptyState>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}