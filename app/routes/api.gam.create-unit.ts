import type { LoaderFunctionArgs } from "react-router";
import { createAdUnit } from "../services/gam.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (!shop) return Response.json({ error: "missing shop" }, { status: 400 });

  try {
    const result = await createAdUnit(shop, "retailiq_test_slot", 728, 90);
    return Response.json({ result });
  } catch (err: any) {
    return Response.json({ error: err.message });
  }
}