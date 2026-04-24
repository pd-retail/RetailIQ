import { useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import {
  Page,
  Layout,
  Card,
  Button,
  IndexTable,
  Text,
  Badge,
  Modal,
  FormLayout,
  TextField,
  Select,
  BlockStack,
  InlineStack,
  EmptyState,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// ── Types ─────────────────────────────────────────────────────────────────────
type AdSlot = {
  id: string;
  name: string;
  placement: string;
  width: number;
  height: number;
  active: boolean;
  createdAt: string;
};

// ── Loader ────────────────────────────────────────────────────────────────────
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const slots = await db.adSlot.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });
  return { slots };
}

// ── Action ────────────────────────────────────────────────────────────────────
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const name = formData.get("name") as string;
    const placement = formData.get("placement") as string;
    const size = formData.get("size") as string;
    const [width, height] = size.split("x").map(Number);

    if (!name || !placement || !size) {
      return { error: "All fields are required." };
    }

    const slot = await db.adSlot.create({
      data: { shop: session.shop, name, placement, width, height, active: true },
    });

// Auto-create GAM Ad Unit
    try {
      const { createAdUnit } = await import("../services/gam.server");
      const result = await createAdUnit(session.shop, `retailiq_${slot.id}`, width, height);
      if (result?.adUnitId) {
        await db.adSlot.update({
          where: { id: slot.id },
          data: {
            gamAdUnitId: result.adUnitId,
            gamAdUnitCode: result.adUnitCode ?? undefined,
          },
        });
      }
    } catch (err) {
      console.error("GAM ad unit creation failed:", err);
    }
    return { success: "Slot created." };
  }
  if (intent === "delete") {
    const id = formData.get("id") as string;
    await db.adSlot.delete({ where: { id } });
    return { success: "Slot deleted." };
  }

  if (intent === "toggle") {
    const id = formData.get("id") as string;
    const active = formData.get("active") === "true";
    await db.adSlot.update({ where: { id }, data: { active: !active } });
    return { success: "Slot updated." };
  }

  return { error: "Unknown action." };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PLACEMENT_OPTIONS = [
  { label: "Homepage", value: "homepage" },
  { label: "Product Page", value: "product" },
  { label: "Collection Page", value: "collection" },
  { label: "Cart Page", value: "cart" },
  { label: "Post-Purchase", value: "post_purchase" },
];

const SIZE_OPTIONS = [
  { label: "Leaderboard — 728 x 90", value: "728x90" },
  { label: "Medium Rectangle — 300 x 250", value: "300x250" },
  { label: "Large Rectangle — 336 x 280", value: "336x280" },
  { label: "Half Page — 300 x 600", value: "300x600" },
  { label: "Mobile Banner — 320 x 50", value: "320x50" },
  { label: "Billboard — 970 x 250", value: "970x250" },
];

const PLACEMENT_LABELS: Record<string, string> = {
  homepage: "Homepage",
  product: "Product Page",
  collection: "Collection Page",
  cart: "Cart Page",
  post_purchase: "Post-Purchase",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function SlotsPage() {
  const { slots } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "submitting";

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [placement, setPlacement] = useState("homepage");
  const [size, setSize] = useState("728x90");

  const handleOpenModal = useCallback(() => {
    setName("");
    setPlacement("homepage");
    setSize("728x90");
    setModalOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    submit(
      { intent: "create", name, placement, size },
      { method: "post" }
    );
    setModalOpen(false);
  }, [name, placement, size, submit]);

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm("Delete this ad slot?")) {
        submit({ intent: "delete", id }, { method: "post" });
      }
    },
    [submit]
  );

  const handleToggle = useCallback(
    (id: string, active: boolean) => {
      submit({ intent: "toggle", id, active: String(active) }, { method: "post" });
    },
    [submit]
  );

  const rowMarkup = (slots as AdSlot[]).map((slot, index) => (
    <IndexTable.Row id={slot.id} key={slot.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">{slot.name}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {PLACEMENT_LABELS[slot.placement] ?? slot.placement}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {slot.width} × {slot.height}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm" tone="subdued" as="span">{slot.id}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={slot.active ? "success" : "enabled"}>
          {slot.active ? "Active" : "Paused"}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button
            size="slim"
            onClick={() => handleToggle(slot.id, slot.active)}
            loading={isLoading}
          >
            {slot.active ? "Pause" : "Activate"}
          </Button>
          <Button
            size="slim"
            tone="critical"
            onClick={() => handleDelete(slot.id)}
            loading={isLoading}
          >
            Delete
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Ad Slots"
      subtitle="Define where banners appear on your storefront."
      primaryAction={
        <Button variant="primary" onClick={handleOpenModal}>
          Create slot
        </Button>
      }
    >
      <Layout>
        <Layout.Section>
          {slots.length === 0 ? (
            <Card>
              <EmptyState
                heading="No ad slots yet"
                action={{ content: "Create slot", onAction: handleOpenModal }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Create your first ad slot to start displaying banners on your store.</p>
              </EmptyState>
            </Card>
          ) : (
            <Card padding="0">
              <IndexTable
                resourceName={{ singular: "slot", plural: "slots" }}
                itemCount={slots.length}
                headings={[
                  { title: "Name" },
                  { title: "Placement" },
                  { title: "Size (px)" },
                  { title: "Slot ID" },
                  { title: "Status" },
                  { title: "Actions" },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            </Card>
          )}
        </Layout.Section>
      </Layout>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create ad slot"
        primaryAction={{
          content: "Create slot",
          onAction: handleCreate,
          disabled: !name,
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setModalOpen(false) },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Banner tone="info">
              Each slot maps to one position on your storefront. You can create
              multiple slots for different pages.
            </Banner>
            <FormLayout>
              <TextField
                label="Slot name"
                value={name}
                onChange={setName}
                placeholder="e.g. Homepage Hero Banner"
                autoComplete="off"
                helpText="Used to identify this slot in the admin."
              />
              <Select
                label="Placement"
                options={PLACEMENT_OPTIONS}
                value={placement}
                onChange={setPlacement}
                helpText="Where on the storefront this slot will appear."
              />
              <Select
                label="Banner size"
                options={SIZE_OPTIONS}
                value={size}
                onChange={setSize}
                helpText="Standard IAB sizes. Match the size to the space available in your theme."
              />
            </FormLayout>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}