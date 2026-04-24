import sharp from "sharp";

export type BannerInput = {
  productImageUrl: string;
  productTitle: string;
  productPrice: string;
  compareAtPrice?: string | null;
  ctaText?: string;
  template?: "spotlight" | "horizontal" | "mobile";
  width?: number;
  height?: number;
};

// Brand colours
const NAVY   = "#041c2d";
const ORANGE = "#fc7917";
const WHITE  = "#ffffff";

// ── SVG helpers ───────────────────────────────────────────────────────────────
function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Template: Product Spotlight 300×250 ───────────────────────────────────────
function spotlightSvg(
  title: string,
  price: string,
  compareAt: string | null,
  cta: string,
  w: number,
  h: number
): string {
  const onSale = compareAt && parseFloat(compareAt) > parseFloat(price);
  return `
  <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <!-- Dark overlay gradient over bottom half -->
    <defs>
      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="40%" stop-color="${NAVY}" stop-opacity="0"/>
        <stop offset="100%" stop-color="${NAVY}" stop-opacity="0.92"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#grad)"/>

    <!-- Sale badge -->
    ${onSale ? `
    <rect x="12" y="12" width="60" height="24" rx="4" fill="${ORANGE}"/>
    <text x="42" y="29" font-family="Arial" font-size="13" font-weight="bold"
      fill="${WHITE}" text-anchor="middle">SALE</text>
    ` : ""}

    <!-- Product title -->
    <text x="16" y="${h - 72}" font-family="Arial" font-size="15" font-weight="bold"
      fill="${WHITE}" width="${w - 32}">${escapeXml(truncate(title, 36))}</text>

    <!-- Price -->
    <text x="16" y="${h - 50}" font-family="Arial" font-size="20" font-weight="bold"
      fill="${ORANGE}">${escapeXml(price)}</text>
    ${onSale ? `
    <text x="${16 + price.length * 12 + 8}" y="${h - 50}" font-family="Arial" font-size="14"
      fill="${WHITE}" opacity="0.6" text-decoration="line-through">${escapeXml(compareAt!)}</text>
    ` : ""}

    <!-- CTA button -->
    <rect x="16" y="${h - 38}" width="${w - 32}" height="28" rx="5" fill="${ORANGE}"/>
    <text x="${w / 2}" y="${h - 19}" font-family="Arial" font-size="14" font-weight="bold"
      fill="${WHITE}" text-anchor="middle">${escapeXml(cta)}</text>
  </svg>`;
}

// ── Template: Horizontal Leaderboard 728×90 ───────────────────────────────────
function horizontalSvg(
  title: string,
  price: string,
  compareAt: string | null,
  cta: string,
  w: number,
  h: number
): string {
  const onSale = compareAt && parseFloat(compareAt) > parseFloat(price);
  return `
  <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <!-- Background -->
    <rect width="${w}" height="${h}" fill="${NAVY}" opacity="0.88"/>

    <!-- Divider line -->
    <line x1="${h + 8}" y1="10" x2="${h + 8}" y2="${h - 10}"
      stroke="${ORANGE}" stroke-width="2" opacity="0.6"/>

    <!-- Title -->
    <text x="${h + 24}" y="34" font-family="Arial" font-size="16" font-weight="bold"
      fill="${WHITE}">${escapeXml(truncate(title, 48))}</text>

    <!-- Price -->
    <text x="${h + 24}" y="62" font-family="Arial" font-size="22" font-weight="bold"
      fill="${ORANGE}">${escapeXml(price)}</text>
    ${onSale ? `
    <text x="${h + 24 + price.length * 13 + 8}" y="62" font-family="Arial" font-size="14"
      fill="${WHITE}" opacity="0.5" text-decoration="line-through">${escapeXml(compareAt!)}</text>
    ` : ""}

    <!-- CTA button -->
    <rect x="${w - 160}" y="20" width="140" height="50" rx="6" fill="${ORANGE}"/>
    <text x="${w - 90}" y="51" font-family="Arial" font-size="15" font-weight="bold"
      fill="${WHITE}" text-anchor="middle">${escapeXml(cta)}</text>
  </svg>`;
}

// ── Template: Mobile Banner 320×50 ────────────────────────────────────────────
function mobileSvg(
  title: string,
  price: string,
  cta: string,
  w: number,
  h: number
): string {
  return `
  <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="${NAVY}"/>
    <text x="12" y="32" font-family="Arial" font-size="13" font-weight="bold"
      fill="${WHITE}">${escapeXml(truncate(title, 28))}</text>
    
    <text x="${w / 2}" y="32" font-family="Arial" font-size="13" font-weight="bold"
      fill="${ORANGE}">${escapeXml(price)}</text>
    <!-- CTA -->
    <rect x="${w - 100}" y="8" width="88" height="34" rx="4" fill="${ORANGE}"/>
    <text x="${w - 56}" y="30" font-family="Arial" font-size="12" font-weight="bold"
      fill="${WHITE}" text-anchor="middle">${escapeXml(cta)}</text>
  </svg>`;
}

// ── Main generator ────────────────────────────────────────────────────────────
export async function generateBanner(input: BannerInput): Promise<Buffer> {
  const {
    productImageUrl,
    productTitle,
    productPrice,
    compareAtPrice = null,
    ctaText = "Shop Now",
    template = "spotlight",
    width,
    height,
  } = input;

  // Resolve dimensions from template
  const dims =
    template === "horizontal"
      ? { w: width ?? 728, h: height ?? 90 }
      : template === "mobile"
      ? { w: width ?? 320, h: height ?? 50 }
      : { w: width ?? 300, h: height ?? 250 };

  const { w, h } = dims;

  // Fetch product image
  let baseImage: Buffer;
  if (productImageUrl) {
    const imgResponse = await fetch(productImageUrl);
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
    baseImage = await sharp(imgBuffer)
      .resize(w, h, { fit: "cover", position: "centre" })
      .toBuffer();
  } else {
    // No product image — use a solid navy background
    baseImage = await sharp({
      create: { width: w, height: h, channels: 4, background: { r: 4, g: 28, b: 45, alpha: 1 } }
    }).png().toBuffer();
  }

  // Build SVG overlay
  const svgOverlay =
    template === "horizontal"
      ? horizontalSvg(productTitle, productPrice, compareAtPrice, ctaText, w, h)
      : template === "mobile"
      ? mobileSvg(productTitle, productPrice, ctaText, w, h)
      : spotlightSvg(productTitle, productPrice, compareAtPrice, ctaText, w, h);

  // Composite image + SVG overlay
  const banner = await sharp(baseImage)
    .composite([
      { input: Buffer.from(svgOverlay), top: 0, left: 0 },
    ])
    .png()
    .toBuffer();

  return banner;
}

// ── Dimensions helper ─────────────────────────────────────────────────────────
export function dimensionsForTemplate(template: string): { w: number; h: number } {
  if (template === "horizontal") return { w: 728, h: 90 };
  if (template === "mobile")     return { w: 320, h: 50 };
  return { w: 300, h: 250 };
}