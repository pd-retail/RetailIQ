import type { LoaderFunctionArgs } from "react-router";
import { getGamClient } from "../services/gam.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (!shop) return Response.json({ error: "missing shop" }, { status: 400 });

  const { token, networkCode } = await getGamClient(shop);

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>
    <ns1:RequestHeader xmlns:ns1="https://www.google.com/apis/ads/publisher/v202505">
      <ns1:networkCode>${networkCode}</ns1:networkCode>
      <ns1:applicationName>RetailIQ</ns1:applicationName>
    </ns1:RequestHeader>
  </soapenv:Header>
  <soapenv:Body>
    <getCurrentNetwork xmlns="https://www.google.com/apis/ads/publisher/v202505"/>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await fetch(
    "https://ads.google.com/apis/ads/publisher/v202505/NetworkService",
    {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        "SOAPAction": "",
        "Authorization": `Bearer ${token}`,
      },
      body: soapBody,
    }
  );

  const text = await response.text();
  return Response.json({ response: text });
}