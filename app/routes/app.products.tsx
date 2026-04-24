import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  EmptyState,
  Pagination,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getProducts } from "../services/products.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const after = url.searchParams.get("after") ?? undefined;
  const { products, hasNextPage, endCursor } = await getProducts(admin, 20, after);
  return { products, hasNextPage, endCursor };
}

export default function ProductsPage() {
  const { products, hasNextPage, endCursor } = useLoaderData<typeof loader>();

  return (
    <Page
      title="Product Feed"
      subtitle="Products pulled live from your Shopify store. These will be used to generate banners."
    >
      <Layout>
        <Layout.Section>
          {products.length === 0 ? (
            <Card>
              <EmptyState
                heading="No active products found"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Make sure your store has active products published to the Online Store channel.</p>
              </EmptyState>
            </Card>
          ) : (
            <Card padding="0">
              <ResourceList
                resourceName={{ singular: "product", plural: "products" }}
                items={products}
                renderItem={(product) => {
                  const variant = product.variants[0];
                  const price = variant
                    ? `${product.priceRange.minVariantPrice.currencyCode} ${parseFloat(variant.price).toFixed(2)}`
                    : "—";
                  const compareAt = variant?.compareAtPrice
                    ? parseFloat(variant.compareAtPrice).toFixed(2)
                    : null;
                  const onSale = compareAt && parseFloat(variant!.compareAtPrice!) > parseFloat(variant!.price);

                  return (
                    <ResourceItem
                      id={product.id}
                      media={
                        <Thumbnail
                          source={product.featuredImage?.url ?? ImageIcon}
                          alt={product.featuredImage?.altText ?? product.title}
                          size="medium"
                        />
                      }
                      accessibilityLabel={`View ${product.title}`}
                    >
                      <BlockStack gap="100">
                        <InlineStack align="space-between">
                          <Text variant="bodyMd" fontWeight="bold" as="span">
                            {product.title}
                          </Text>
                          <InlineStack gap="200">
                            {onSale && <Badge tone="success">On sale</Badge>}
                            {variant && !variant.availableForSale && (
                              <Badge tone="critical">Out of stock</Badge>
                            )}
                          </InlineStack>
                        </InlineStack>
                        <InlineStack gap="200">
                          <Text variant="bodySm" as="span">{price}</Text>
                          {compareAt && onSale && (
                            <Text variant="bodySm" as="span" tone="subdued">
                              was {product.priceRange.minVariantPrice.currencyCode} {compareAt}
                            </Text>
                          )}
                        </InlineStack>
                        {product.productType && (
                          <Text variant="bodySm" tone="subdued" as="span">
                            {product.productType}
                            {product.vendor ? ` · ${product.vendor}` : ""}
                          </Text>
                        )}
                      </BlockStack>
                    </ResourceItem>
                  );
                }}
              />
            </Card>
          )}

          {hasNextPage && (
            <Pagination
              hasPrevious={false}
              hasNext={hasNextPage}
              onNext={() => {
                window.location.href = `/app/products?after=${endCursor}`;
              }}
            />
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}