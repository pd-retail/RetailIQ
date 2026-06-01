import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

export type ShopifyProduct = {
  id: string;
  title: string;
  onlineStoreUrl: string | null;
  featuredImage: { url: string; altText: string | null } | null;
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
  compareAtPriceRange: { minVariantCompareAtPrice: { amount: string; currencyCode: string } };
  variants: {
    id: string;
    price: string;
    compareAtPrice: string | null;
    availableForSale: boolean;
    sku: string | null;
  }[];
  tags: string[];
  productType: string;
  vendor: string;
};

const PRODUCTS_QUERY = `#graphql
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, query: "status:active") {
      edges {
        node {
          id
          title
          onlineStoreUrl
          featuredImage {
            url
            altText
          }
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          compareAtPriceRange {
            minVariantCompareAtPrice {
              amount
              currencyCode
            }
          }
          variants(first: 1) {
            edges {
              node {
                id
                price
                compareAtPrice
                availableForSale
                sku
              }
            }
          }
          tags
          productType
          vendor
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export async function getProducts(
  admin: AdminApiContext,
  first = 20,
  after?: string
): Promise<{ products: ShopifyProduct[]; hasNextPage: boolean; endCursor: string | null }> {
  const response = await admin.graphql(PRODUCTS_QUERY, {
    variables: { first, after: after ?? null },
  });

  const data = await response.json();
  const edges = data.data?.products?.edges ?? [];
  const pageInfo = data.data?.products?.pageInfo ?? {};

  const products: ShopifyProduct[] = edges.map((edge: any) => ({
    id: edge.node.id,
    title: edge.node.title,
    onlineStoreUrl: edge.node.onlineStoreUrl,
    featuredImage: edge.node.featuredImage,
    priceRange: edge.node.priceRangeV2,
    compareAtPriceRange: edge.node.compareAtPriceRange,
    variants: edge.node.variants.edges.map((v: any) => ({
      id: v.node.id,
      price: v.node.price,
      compareAtPrice: v.node.compareAtPrice,
      availableForSale: v.node.availableForSale,
      sku: v.node.sku,
    })),
    tags: edge.node.tags,
    productType: edge.node.productType,
    vendor: edge.node.vendor,
  }));

  return {
    products,
    hasNextPage: pageInfo.hasNextPage ?? false,
    endCursor: pageInfo.endCursor ?? null,
  };
}