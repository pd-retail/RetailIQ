import { useState, useCallback, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
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
  DropZone,
  Thumbnail,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  getOrCreateAdvertiser,
  createImageCreative,
  getOrCreateOrder,
  createLineItem,
  createLineItemCreativeAssociation,
  approveOrder,
} from "../services/gam.server";

// ── Types ─────────────────────────────────────────────────────────────────────
type Campaign = {
  id: string;
  name: string;
  slotId: string;
  productTitle: string;
  status: string;
  gamLineItemId: string | null;
  gamCreativeId: string | null;
  createdAt: string;
};

type AdSlot = {
  id: string;
  name: string;
  width: number;
  height: number;
  gamAdUnitId: string | null;
};

type SelectedProduct = {
  id: string;
  title: string;
  handle: string;
  imageUrl: string;
  price: string;
};

// ── Banner Generator ───────────────────────────────────────────────────────────
async function generateBannerCanvas(
  productImageUrl: string,
  productTitle: string,
  price: string,
  width: number,
  height: number
): Promise<{ preview: string; base64: string }> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    const draw = (img?: HTMLImageElement) => {
      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      // Light border
      ctx.strokeStyle = "#dddddd";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

      const padding = Math.round(width * 0.05);
      const imgAreaH = Math.round(height * 0.52);

      // Product image
      if (img) {
        const scale = Math.min(
          (width - padding * 2) / img.width,
          (imgAreaH - padding) / img.height
        );
        const imgW = img.width * scale;
        const imgH = img.height * scale;
        const imgX = (width - imgW) / 2;
        const imgY = padding / 2 + (imgAreaH - imgH) / 2;
        ctx.drawImage(img, imgX, imgY, imgW, imgH);
      }

      // Divider line
      ctx.strokeStyle = "#eeeeee";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, imgAreaH);
      ctx.lineTo(width - padding, imgAreaH);
      ctx.stroke();

      // Product title (up to 2 lines)
      const titleSize = Math.max(11, Math.round(height * 0.056));
      ctx.fillStyle = "#111111";
      ctx.font = `${titleSize}px Arial, sans-serif`;
      ctx.textAlign = "center";
      const lineH = titleSize * 1.3;
      const words = productTitle.split(" ");
      let line = "";
      let lines: string[] = [];
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > width - padding * 2 && line) {
          lines.push(line);
          line = word;
          if (lines.length === 2) break;
        } else {
          line = test;
        }
      }
      if (lines.length < 2) lines.push(line);
      const titleY = imgAreaH + lineH + 2;
      lines.slice(0, 2).forEach((l, i) => {
        ctx.fillText(l, width / 2, titleY + i * lineH);
      });

      // Price
      const priceSize = Math.max(13, Math.round(height * 0.072));
      ctx.fillStyle = "#B12704";
      ctx.font = `bold ${priceSize}px Arial, sans-serif`;
      const priceY = titleY + lines.length * lineH + priceSize * 0.3;
      ctx.fillText(price ? `$${price}` : "", width / 2, priceY);

      // Shop Now button
      const btnH = Math.round(height * 0.12);
      const btnY = height - padding * 0.5 - btnH;
      const btnRadius = 4;
      const btnX = padding;
      const btnW = width - padding * 2;

      ctx.fillStyle = "#FF9900";
      ctx.beginPath();
      ctx.moveTo(btnX + btnRadius, btnY);
      ctx.lineTo(btnX + btnW - btnRadius, btnY);
      ctx.arcTo(btnX + btnW, btnY, btnX + btnW, btnY + btnRadius, btnRadius);
      ctx.lineTo(btnX + btnW, btnY + btnH - btnRadius);
      ctx.arcTo(btnX + btnW, btnY + btnH, btnX + btnW - btnRadius, btnY + btnH, btnRadius);
      ctx.lineTo(btnX + btnRadius, btnY + btnH);
      ctx.arcTo(btnX, btnY + btnH, btnX, btnY + btnH - btnRadius, btnRadius);
      ctx.lineTo(btnX, btnY + btnRadius);
      ctx.arcTo(btnX, btnY, btnX + btnRadius, btnY, btnRadius);
      ctx.closePath();
      ctx.fill();

      const btnFontSize = Math.max(10, Math.round(height * 0.052));
      ctx.fillStyle = "#111111";
      ctx.font = `bold ${btnFontSize}px Arial, sans-serif`;
      ctx.fillText("Shop Now", width / 2, btnY + btnH / 2 + btnFontSize * 0.35);

      const dataUrl = canvas.toDataURL("image/png");
      resolve({ preview: dataUrl, base64: dataUrl.split(",")[1] });
    };

    if (productImageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => draw(img);
      img.onerror = () => draw();
      img.src = productImageUrl;
    } else {
      draw();
    }
  });
}

// ── Loader ────────────────────────────────────────────────────────────────────
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const [campaigns, slots] = await Promise.all([
    db.campaign.findMany({
      where: { shop: session.shop },
      orderBy: { createdAt: "desc" },
    }),
    db.adSlot.findMany({
      where: { shop: session.shop, active: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { campaigns, slots, shop: session.shop };
}

// ── Action ────────────────────────────────────────────────────────────────────
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "generate") {
    const name = formData.get("name") as string;
    const slotId = formData.get("slotId") as string;
    const productId = (formData.get("productId") as string) || "";
    const productTitle = (formData.get("productTitle") as string) || "";
    const productImageUrl = (formData.get("productImageUrl") as string) || "";
    const productPrice = (formData.get("productPrice") as string) || "";
    const productUrl = (formData.get("productUrl") as string) || "";
    const bannerUrl = (formData.get("bannerUrl") as string) || "";
    const template = (formData.get("template") as string) || "spotlight";
    const imageBase64 = formData.get("imageBase64") as string;
    const width = parseInt(formData.get("width") as string, 10);
    const height = parseInt(formData.get("height") as string, 10);

    if (!name || !slotId || !imageBase64) {
      return { error: "Name, slot, and banner image are required." };
    }

    const slot = await db.adSlot.findUnique({ where: { id: slotId } });
    let gamCreativeId: string | null = null;
    let gamLineItemId: string | null = null;
    let campaignStatus = "draft";
    try {
      const buffer = Buffer.from(imageBase64, "base64");
      const advertiserId = await getOrCreateAdvertiser(session.shop);
      const creativeName = `retailiq_${name.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}`;
      gamCreativeId = await createImageCreative(
        session.shop,
        creativeName,
        width,
        height,
        buffer,
        productUrl || "https://retailiq.io",
        advertiserId
      );
      console.log("GAM Creative ID:", gamCreativeId);

      if (gamCreativeId && slot?.gamAdUnitId) {
        const orderId = await getOrCreateOrder(session.shop);
        if (orderId) {
          gamLineItemId = await createLineItem(
            session.shop,
            creativeName,
            orderId,
            slot.gamAdUnitId,
            width,
            height
          );
          if (gamLineItemId) {
            console.log("GAM Line Item ID:", gamLineItemId);
            await createLineItemCreativeAssociation(
              session.shop,
              gamLineItemId,
              gamCreativeId,
              width,
              height
            );
            await approveOrder(session.shop, orderId);
            campaignStatus = "active";
          }
        }
      }
    } catch (err) {
      console.error("GAM creative upload failed:", err);
    }

    await db.campaign.create({
      data: {
        shop: session.shop,
        name,
        slotId,
        productId,
        productTitle,
        productImageUrl,
        productPrice,
        productUrl,
        bannerUrl,
        template,
        status: campaignStatus,
        gamCreativeId: gamCreativeId ?? undefined,
        gamLineItemId: gamLineItemId ?? undefined,
      },
    });

    return { success: "Banner campaign created." };
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await db.campaign.delete({ where: { id } });
    return { success: "Campaign deleted." };
  }

  return { error: "Unknown action." };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BannersPage() {
  const { campaigns, slots, shop } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const isLoading = navigation.state === "submitting";

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [slotId, setSlotId] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [generatedBase64, setGeneratedBase64] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const slotOptions = (slots as AdSlot[]).map((s) => ({
    label: `${s.name} (${s.width}×${s.height})`,
    value: s.id,
  }));

  const selectedSlot = (slots as AdSlot[]).find((s) => s.id === slotId);

  // Auto-regenerate banner when product or slot changes
  useEffect(() => {
    if (!selectedProduct || !selectedSlot) return;
    setIsGenerating(true);
    generateBannerCanvas(
      selectedProduct.imageUrl,
      selectedProduct.title,
      selectedProduct.price,
      selectedSlot.width,
      selectedSlot.height
    ).then(({ preview, base64 }) => {
      setImagePreview(preview);
      setGeneratedBase64(base64);
      setImageFile(null);
      setIsGenerating(false);
    });
  }, [selectedProduct, selectedSlot]);

  const handleOpenModal = useCallback(() => {
    setName("");
    setSlotId(slotOptions[0]?.value ?? "");
    setProductUrl("");
    setSelectedProduct(null);
    setImageFile(null);
    setImagePreview(null);
    setGeneratedBase64(null);
    setModalOpen(true);
  }, [slotOptions]);

  const handlePickProduct = useCallback(async () => {
    const selected = await shopify.resourcePicker({ type: "product", multiple: false });
    if (!selected || selected.length === 0) return;
    const product = selected[0] as any;
    const variant = product.variants?.[0];
    const picked: SelectedProduct = {
      id: product.id,
      title: product.title,
      handle: product.handle,
      imageUrl: product.images?.[0]?.originalSrc ?? product.images?.[0]?.src ?? "",
      price: variant?.price ?? "",
    };
    setSelectedProduct(picked);
    setProductUrl(`https://${shop}/products/${product.handle}`);
    if (!name) setName(product.title);
  }, [shopify, shop, name]);

  const handleDropZone = useCallback(
    (_dropFiles: File[], acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      setImageFile(file);
      setGeneratedBase64(null);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    },
    []
  );

  const handleGenerate = useCallback(async () => {
    if (!name || !slotId || !selectedSlot) return;
    if (!imageFile && !generatedBase64) return;

    const submitWithBase64 = (base64: string) => {
      submit(
        {
          intent: "generate",
          name,
          slotId,
          productUrl,
          productId: selectedProduct?.id ?? "",
          productTitle: selectedProduct?.title ?? name,
          productImageUrl: selectedProduct?.imageUrl ?? "",
          productPrice: selectedProduct?.price ?? "",
          bannerUrl: "",
          template: "spotlight",
          imageBase64: base64,
          width: String(selectedSlot.width),
          height: String(selectedSlot.height),
        },
        { method: "post" }
      );
      setModalOpen(false);
    };

    if (imageFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        submitWithBase64(dataUrl.split(",")[1]);
      };
      reader.readAsDataURL(imageFile);
    } else if (generatedBase64) {
      submitWithBase64(generatedBase64);
    }
  }, [name, slotId, imageFile, generatedBase64, selectedSlot, productUrl, selectedProduct, submit]);

  const handleDelete = useCallback(
    (id: string) => {
      if (confirm("Delete this campaign?")) {
        submit({ intent: "delete", id }, { method: "post" });
      }
    },
    [submit]
  );

  const hasImage = !!imageFile || !!generatedBase64;

  const rowMarkup = (campaigns as Campaign[]).map((campaign, index) => (
    <IndexTable.Row id={campaign.id} key={campaign.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {campaign.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{campaign.productTitle}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={campaign.status === "active" ? "success" : "enabled"}>
          {campaign.status}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm" tone="subdued" as="span">
          {campaign.gamLineItemId ?? "—"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button
          size="slim"
          tone="critical"
          onClick={() => handleDelete(campaign.id)}
          loading={isLoading}
        >
          Delete
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Banners"
      subtitle="Create and manage sponsored banner campaigns."
      primaryAction={
        slots.length > 0
          ? { content: "Create banner", onAction: handleOpenModal }
          : undefined
      }
    >
      <Layout>
        <Layout.Section>
          {slots.length === 0 ? (
            <Card>
              <EmptyState
                heading="No ad slots configured"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Create an ad slot first before adding banners.</p>
              </EmptyState>
            </Card>
          ) : campaigns.length === 0 ? (
            <Card>
              <EmptyState
                heading="No banners yet"
                action={{ content: "Create banner", onAction: handleOpenModal }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Select a product to auto-generate your first banner campaign.</p>
              </EmptyState>
            </Card>
          ) : (
            <Card padding="0">
              <IndexTable
                resourceName={{ singular: "campaign", plural: "campaigns" }}
                itemCount={campaigns.length}
                headings={[
                  { title: "Name" },
                  { title: "Product" },
                  { title: "Status" },
                  { title: "GAM Line Item ID" },
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
        title="Create banner campaign"
        primaryAction={{
          content: "Generate",
          onAction: handleGenerate,
          disabled: !name || !slotId || !hasImage || isGenerating,
          loading: isLoading || isGenerating,
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setModalOpen(false) },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Banner tone="info">
              Select a product to auto-generate a banner, or upload your own image.
            </Banner>
            <FormLayout>
              <TextField
                label="Campaign name"
                value={name}
                onChange={setName}
                placeholder="e.g. Summer Sale — Leaderboard"
                autoComplete="off"
              />
              <Select
                label="Ad slot"
                options={slotOptions}
                value={slotId}
                onChange={setSlotId}
                helpText={
                  selectedSlot
                    ? `Size: ${selectedSlot.width}×${selectedSlot.height}px`
                    : undefined
                }
              />

              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  Product{" "}
                  <Text as="span" tone="subdued">
                    (optional)
                  </Text>
                </Text>
                {selectedProduct ? (
                  <InlineStack gap="300" blockAlign="center">
                    {selectedProduct.imageUrl && (
                      <Thumbnail
                        size="small"
                        source={selectedProduct.imageUrl}
                        alt={selectedProduct.title}
                      />
                    )}
                    <BlockStack gap="100">
                      <Text variant="bodyMd" fontWeight="bold" as="span">
                        {selectedProduct.title}
                      </Text>
                      {selectedProduct.price && (
                        <Text variant="bodySm" tone="subdued" as="span">
                          ${selectedProduct.price}
                        </Text>
                      )}
                    </BlockStack>
                    <Button size="slim" onClick={handlePickProduct}>
                      Change
                    </Button>
                  </InlineStack>
                ) : (
                  <Button onClick={handlePickProduct}>Select product</Button>
                )}
              </BlockStack>

              <TextField
                label="Product URL"
                value={productUrl}
                onChange={setProductUrl}
                placeholder="https://yourstore.com/products/example"
                autoComplete="off"
                helpText="Where users go when they click the banner. Auto-filled when you select a product."
              />

              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="p" variant="bodyMd">
                    Banner image
                  </Text>
                  {generatedBase64 && !imageFile && (
                    <Text as="span" variant="bodySm" tone="subdued">
                      Auto-generated — or upload your own below
                    </Text>
                  )}
                </InlineStack>

                {imagePreview ? (
                  <BlockStack gap="200">
                    <InlineStack align="center">
                      <img
                        src={imagePreview}
                        alt="Banner preview"
                        style={{
                          maxWidth: "100%",
                          maxHeight: "200px",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                        }}
                      />
                    </InlineStack>
                    <Button
                      size="slim"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        setGeneratedBase64(null);
                      }}
                    >
                      Remove image
                    </Button>
                  </BlockStack>
                ) : (
                  <DropZone
                    accept="image/png,image/jpeg"
                    type="image"
                    onDrop={handleDropZone}
                    allowMultiple={false}
                  >
                    <DropZone.FileUpload
                      actionTitle="Upload banner"
                      actionHint={
                        selectedSlot
                          ? `PNG or JPG, ${selectedSlot.width}×${selectedSlot.height}px`
                          : "PNG or JPG"
                      }
                    />
                  </DropZone>
                )}
              </BlockStack>
            </FormLayout>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
