import { OAuth2Client } from "google-auth-library";
import db from "../db.server";
const NETWORK_CODE = process.env.GAM_NETWORK_CODE!;
const API_VERSION = "v202505";
const GAM_ENDPOINT = `https://ads.google.com/apis/ads/publisher/${API_VERSION}`;

export async function getGamClient(shop: string) {
  const connection = await db.gamConnection.findUnique({ where: { shop } });
  if (!connection) throw new Error("GAM not connected");
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.SHOPIFY_APP_URL}/auth/google/callback`
  );
  client.setCredentials({
    refresh_token: connection.refreshToken,
  });
  const { token } = await client.getAccessToken();
  const credentials = await client.getAccessToken();
  if (credentials.token) {
    await db.gamConnection.update({
      where: { shop },
      data: { accessToken: credentials.token },
    });
  }
  return { token, networkCode: connection.networkCode };
}

export async function createAdUnit(shop: string, name: string, width: number, height: number) {
  const { token, networkCode } = await getGamClient(shop);
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Header>
    <ns1:RequestHeader xmlns:ns1="https://www.google.com/apis/ads/publisher/${API_VERSION}">
      <ns1:networkCode>${networkCode}</ns1:networkCode>
      <ns1:applicationName>RetailIQ</ns1:applicationName>
    </ns1:RequestHeader>
  </soapenv:Header>
  <soapenv:Body>
    <createAdUnits xmlns="https://www.google.com/apis/ads/publisher/${API_VERSION}">
      <adUnits>
        <parentId>97883458</parentId>
        <name>${name}</name>
        <targetWindow>BLANK</targetWindow>
        <adUnitSizes>
          <size><width>${width}</width><height>${height}</height><isAspectRatio>false</isAspectRatio></size>
          <environmentType>BROWSER</environmentType>
        </adUnitSizes>
      </adUnits>
    </createAdUnits>
  </soapenv:Body>
</soapenv:Envelope>`;
  const response = await fetch(`${GAM_ENDPOINT}/InventoryService`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "SOAPAction": "",
      "Authorization": `Bearer ${token}`,
    },
    body: soapBody,
  });
  const text = await response.text();
  const idMatch = text.match(/<id>(\d+)<\/id>/);
  const codeMatch = text.match(/<adUnitCode>(\w+)<\/adUnitCode>/);
  const adUnitId = idMatch ? idMatch[1] : null;
  const adUnitCode = codeMatch ? codeMatch[1] : null;
  console.log("GAM createAdUnit created ID:", adUnitId, "code:", adUnitCode);
  return { adUnitId, adUnitCode };
}

export async function getOrCreateAdvertiser(shop: string): Promise<string> {
  const { token, networkCode } = await getGamClient(shop);
  const filterSoap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>
    <ns1:RequestHeader xmlns:ns1="https://www.google.com/apis/ads/publisher/v202505">
      <ns1:networkCode>${networkCode}</ns1:networkCode>
      <ns1:applicationName>RetailIQ</ns1:applicationName>
    </ns1:RequestHeader>
  </soapenv:Header>
  <soapenv:Body>
    <getCompaniesByStatement xmlns="https://www.google.com/apis/ads/publisher/v202505">
      <filterStatement>
        <query>WHERE name = 'RetailIQ' AND type = 'ADVERTISER' LIMIT 1</query>
      </filterStatement>
    </getCompaniesByStatement>
  </soapenv:Body>
</soapenv:Envelope>`;
  const filterRes = await fetch(
    "https://ads.google.com/apis/ads/publisher/v202505/CompanyService",
    { method: "POST", headers: { "Content-Type": "text/xml", "SOAPAction": "", "Authorization": `Bearer ${token}` }, body: filterSoap }
  );
  const filterText = await filterRes.text();
  const existing = filterText.match(/<id>(\d+)<\/id>/);
  if (existing) return existing[1];

  const createSoap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>
    <ns1:RequestHeader xmlns:ns1="https://www.google.com/apis/ads/publisher/v202505">
      <ns1:networkCode>${networkCode}</ns1:networkCode>
      <ns1:applicationName>RetailIQ</ns1:applicationName>
    </ns1:RequestHeader>
  </soapenv:Header>
  <soapenv:Body>
    <createCompanies xmlns="https://www.google.com/apis/ads/publisher/v202505">
      <companies>
        <name>RetailIQ</name>
        <type>ADVERTISER</type>
      </companies>
    </createCompanies>
  </soapenv:Body>
</soapenv:Envelope>`;
  const createRes = await fetch(
    "https://ads.google.com/apis/ads/publisher/v202505/CompanyService",
    { method: "POST", headers: { "Content-Type": "text/xml", "SOAPAction": "", "Authorization": `Bearer ${token}` }, body: createSoap }
  );
  const createText = await createRes.text();
  const newId = createText.match(/<id>(\d+)<\/id>/);
  if (!newId) throw new Error("Failed to create advertiser");
  return newId[1];
}

export async function createImageCreative(
  shop: string,
  name: string,
  width: number,
  height: number,
  imageBuffer: Buffer,
  destinationUrl: string,
  advertiserId: string
): Promise<string | null> {
  const { token, networkCode } = await getGamClient(shop);
  const base64Image = imageBuffer.toString("base64");
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Header>
    <ns1:RequestHeader xmlns:ns1="https://www.google.com/apis/ads/publisher/v202505">
      <ns1:networkCode>${networkCode}</ns1:networkCode>
      <ns1:applicationName>RetailIQ</ns1:applicationName>
    </ns1:RequestHeader>
  </soapenv:Header>
  <soapenv:Body>
    <createCreatives xmlns="https://www.google.com/apis/ads/publisher/v202505">
      <creatives xsi:type="ImageCreative">
        <advertiserId>${advertiserId}</advertiserId>
        <name>${name}</name>
        <size><width>${width}</width><height>${height}</height><isAspectRatio>false</isAspectRatio></size>
        <destinationUrl>${destinationUrl}</destinationUrl>
        <primaryImageAsset>
          <assetByteArray>${base64Image}</assetByteArray>
          <fileName>${name}.png</fileName>
          <size><width>${width}</width><height>${height}</height><isAspectRatio>false</isAspectRatio></size>
        </primaryImageAsset>
      </creatives>
    </createCreatives>
  </soapenv:Body>
</soapenv:Envelope>`;
  const response = await fetch(
    "https://ads.google.com/apis/ads/publisher/v202505/CreativeService",
    { method: "POST", headers: { "Content-Type": "text/xml", "SOAPAction": "", "Authorization": `Bearer ${token}` }, body: soapBody }
  );
  const text = await response.text();
  console.log("GAM createImageCreative response:", text);
  const match = text.match(/<id>(\d+)<\/id>/);
  return match ? match[1] : null;
}

export async function getOrCreateOrder(shop: string): Promise<string | null> {
  const connection = await db.gamConnection.findUnique({ where: { shop } });
  if (!connection) return null;
  if (connection.gamOrderId) return connection.gamOrderId;
  const { token, networkCode } = await getGamClient(shop);
  const advertiserId = await getOrCreateAdvertiser(shop);
  const userSoap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>
    <ns1:RequestHeader xmlns:ns1="https://www.google.com/apis/ads/publisher/${API_VERSION}">
      <ns1:networkCode>${networkCode}</ns1:networkCode>
      <ns1:applicationName>RetailIQ</ns1:applicationName>
    </ns1:RequestHeader>
  </soapenv:Header>
  <soapenv:Body>
    <getCurrentUser xmlns="https://www.google.com/apis/ads/publisher/${API_VERSION}"/>
  </soapenv:Body>
</soapenv:Envelope>`;
  const userRes = await fetch(`${GAM_ENDPOINT}/UserService`, {
    method: "POST",
    headers: { "Content-Type": "text/xml", "SOAPAction": "", "Authorization": `Bearer ${token}` },
    body: userSoap,
  });
  const userText = await userRes.text();
  const userIdMatch = userText.match(/<id>(\d+)<\/id>/);
  const userId = userIdMatch ? userIdMatch[1] : null;
  if (!userId) throw new Error("Could not fetch GAM user ID");

  const orderSoap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>
    <ns1:RequestHeader xmlns:ns1="https://www.google.com/apis/ads/publisher/${API_VERSION}">
      <ns1:networkCode>${networkCode}</ns1:networkCode>
      <ns1:applicationName>RetailIQ</ns1:applicationName>
    </ns1:RequestHeader>
  </soapenv:Header>
  <soapenv:Body>
    <createOrders xmlns="https://www.google.com/apis/ads/publisher/${API_VERSION}">
      <orders>
        <name>RetailIQ - ${shop}</name>
        <advertiserId>${advertiserId}</advertiserId>
        <traffickerId>${userId}</traffickerId>
      </orders>
    </createOrders>
  </soapenv:Body>
</soapenv:Envelope>`;
  const orderRes = await fetch(`${GAM_ENDPOINT}/OrderService`, {
    method: "POST",
    headers: { "Content-Type": "text/xml", "SOAPAction": "", "Authorization": `Bearer ${token}` },
    body: orderSoap,
  });
  const orderText = await orderRes.text();
  console.log("GAM createOrder response:", orderText);
  const orderMatch = orderText.match(/<id>(\d+)<\/id>/);
  const orderId = orderMatch ? orderMatch[1] : null;
  if (orderId) {
    await db.gamConnection.update({
      where: { shop },
      data: { gamOrderId: orderId },
    });
  }
  return orderId;
}

export async function createLineItem(
  shop: string,
  name: string,
  orderId: string,
  adUnitId: string,
  width: number,
  height: number
): Promise<string | null> {
  const { token, networkCode } = await getGamClient(shop);
  const wsdlUrl = `${GAM_ENDPOINT}/LineItemService?wsdl`;

  // Use the soap npm package so the WSDL handles XSD field ordering automatically.
  // This avoids the cvc-complex-type.2.4.a "expected creativeTargetings" errors
  // that occur when building the XML manually.
  const soapModule = await import("soap");
  const createClientAsync =
    soapModule.createClientAsync ?? (soapModule as any).default?.createClientAsync;

  const client = await createClientAsync(wsdlUrl, {
    wsdl_headers: { Authorization: `Bearer ${token}` },
  });

  client.addHttpHeader("Authorization", `Bearer ${token}`);
  client.addSoapHeader(
    `<ns1:RequestHeader xmlns:ns1="https://www.google.com/apis/ads/publisher/${API_VERSION}">` +
      `<ns1:networkCode>${networkCode}</ns1:networkCode>` +
      `<ns1:applicationName>RetailIQ</ns1:applicationName>` +
      `</ns1:RequestHeader>`
  );

  const args = {
    lineItems: [
      {
        orderId,
        name,
        startDateTimeType: "IMMEDIATELY",
        unlimitedEndDateTime: true,
        creativeRotationType: "EVEN",
        lineItemType: "HOUSE",
        costPerUnit: { currencyCode: "USD", microAmount: 0 },
        costType: "CPM",
        creativePlaceholders: [
          {
            size: { width, height, isAspectRatio: false },
            expectedCreativeCount: 1,
            creativeSizeType: "PIXEL",
          },
        ],
        primaryGoal: { goalType: "DAILY", unitType: "PERCENTAGE", units: 100 },
        targeting: {
          inventoryTargeting: {
            targetedAdUnits: [{ adUnitId, includeDescendants: true }],
          },
        },
      },
    ],
  };
  try {
    const [result] = await client.createLineItemsAsync(args);
    console.log("GAM createLineItem soap result:", JSON.stringify(result));
    const id = result?.rval?.[0]?.id;
    return id ? String(id) : null;
 } catch (err: any) {
    const fault = err?.root?.Envelope?.Body?.Fault;
    const faultString = fault?.faultstring ?? fault?.detail ?? JSON.stringify(fault);
    console.error("GAM createLineItem FAULT:", faultString ?? err?.message ?? err);
    return null;
  }
}
export async function createLineItemCreativeAssociation(
  shop: string,
  lineItemId: string,
  creativeId: string,
  width: number,
  height: number
): Promise<boolean> {
  const { token, networkCode } = await getGamClient(shop);
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>
    <ns1:RequestHeader xmlns:ns1="https://www.google.com/apis/ads/publisher/${API_VERSION}">
      <ns1:networkCode>${networkCode}</ns1:networkCode>
      <ns1:applicationName>RetailIQ</ns1:applicationName>
    </ns1:RequestHeader>
  </soapenv:Header>
  <soapenv:Body>
    <createLineItemCreativeAssociations xmlns="https://www.google.com/apis/ads/publisher/${API_VERSION}">
      <lineItemCreativeAssociations>
        <lineItemId>${lineItemId}</lineItemId>
        <creativeId>${creativeId}</creativeId>
        <sizes>
          <width>${width}</width>
          <height>${height}</height>
          <isAspectRatio>false</isAspectRatio>
        </sizes>
      </lineItemCreativeAssociations>
    </createLineItemCreativeAssociations>
  </soapenv:Body>
</soapenv:Envelope>`;
  const response = await fetch(
    `${GAM_ENDPOINT}/LineItemCreativeAssociationService`,
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
  console.log("GAM createLineItemCreativeAssociation response:", text);
  return text.includes("<status>ACTIVE</status>");
}
export async function approveOrder(shop: string, orderId: string): Promise<boolean> {

  const { token, networkCode } = await getGamClient(shop);
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>
    <ns1:RequestHeader xmlns:ns1="https://www.google.com/apis/ads/publisher/${API_VERSION}">
      <ns1:networkCode>${networkCode}</ns1:networkCode>
      <ns1:applicationName>RetailIQ</ns1:applicationName>
    </ns1:RequestHeader>
  </soapenv:Header>
  <soapenv:Body>
    <performOrderAction xmlns="https://www.google.com/apis/ads/publisher/${API_VERSION}">
      <orderAction xsi:type="ApproveOrders"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>
      <filterStatement>
        <query>WHERE id = ${orderId}</query>
      </filterStatement>
    </performOrderAction>
  </soapenv:Body>
</soapenv:Envelope>`;
  const response = await fetch(`${GAM_ENDPOINT}/OrderService`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "SOAPAction": "",
      "Authorization": `Bearer ${token}`,
    },
    body: soapBody,
  });
  const text = await response.text();
  console.log("GAM approveOrder response:", text);
  return text.includes("<numChanges>");
}

export async function runGamReport(
  shop: string,
  startDate: string,
  endDate: string
): Promise<string | null> {
  const { token, networkCode } = await getGamClient(shop);
  const [sy, sm, sd] = startDate.split("-");
  const [ey, em, ed] = endDate.split("-");
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>
    <ns1:RequestHeader xmlns:ns1="https://www.google.com/apis/ads/publisher/${API_VERSION}">
      <ns1:networkCode>${networkCode}</ns1:networkCode>
      <ns1:applicationName>RetailIQ</ns1:applicationName>
    </ns1:RequestHeader>
  </soapenv:Header>
  <soapenv:Body>
    <runReportJob xmlns="https://www.google.com/apis/ads/publisher/${API_VERSION}">
      <reportJob>
        <reportQuery>
          <dimensions>LINE_ITEM_ID</dimensions>
          <dimensions>LINE_ITEM_NAME</dimensions>
          <columns>AD_SERVER_IMPRESSIONS</columns>
          <columns>AD_SERVER_CLICKS</columns>
          <columns>AD_SERVER_CTR</columns>
          <columns>AD_SERVER_CPM_AND_CPC_REVENUE</columns>
          <dateRangeType>CUSTOM_DATE</dateRangeType>
          <startDate><year>${sy}</year><month>${sm}</month><day>${sd}</day></startDate>
          <endDate><year>${ey}</year><month>${em}</month><day>${ed}</day></endDate>
        </reportQuery>
      </reportJob>
    </runReportJob>
  </soapenv:Body>
</soapenv:Envelope>`;
  const res = await fetch(`${GAM_ENDPOINT}/ReportService`, {
    method: "POST",
    headers: { "Content-Type": "text/xml", "SOAPAction": "", "Authorization": `Bearer ${token}` },
    body: soapBody,
  });
  const text = await res.text();
  console.log("GAM runReportJob response:", text);
  const match = text.match(/<id>(\d+)<\/id>/);
  return match ? match[1] : null;
}

export async function getReportStatus(shop: string, reportJobId: string): Promise<string> {
  const { token, networkCode } = await getGamClient(shop);
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>
    <ns1:RequestHeader xmlns:ns1="https://www.google.com/apis/ads/publisher/${API_VERSION}">
      <ns1:networkCode>${networkCode}</ns1:networkCode>
      <ns1:applicationName>RetailIQ</ns1:applicationName>
    </ns1:RequestHeader>
  </soapenv:Header>
  <soapenv:Body>
    <getReportJobStatus xmlns="https://www.google.com/apis/ads/publisher/${API_VERSION}">
      <reportJobId>${reportJobId}</reportJobId>
    </getReportJobStatus>
  </soapenv:Body>
</soapenv:Envelope>`;
  const res = await fetch(`${GAM_ENDPOINT}/ReportService`, {
    method: "POST",
    headers: { "Content-Type": "text/xml", "SOAPAction": "", "Authorization": `Bearer ${token}` },
    body: soapBody,
  });
  const text = await res.text();
  const match = text.match(/<rval>(\w+)<\/rval>/);
  return match ? match[1] : "FAILED";
}

export async function getReportDownloadURL(shop: string, reportJobId: string): Promise<string | null> {
  const { token, networkCode } = await getGamClient(shop);
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header>
    <ns1:RequestHeader xmlns:ns1="https://www.google.com/apis/ads/publisher/${API_VERSION}">
      <ns1:networkCode>${networkCode}</ns1:networkCode>
      <ns1:applicationName>RetailIQ</ns1:applicationName>
    </ns1:RequestHeader>
  </soapenv:Header>
  <soapenv:Body>
    <getReportDownloadURL xmlns="https://www.google.com/apis/ads/publisher/${API_VERSION}">
      <reportJobId>${reportJobId}</reportJobId>
      <exportFormat>CSV_DUMP</exportFormat>
    </getReportDownloadURL>
  </soapenv:Body>
</soapenv:Envelope>`;
  const res = await fetch(`${GAM_ENDPOINT}/ReportService`, {
    method: "POST",
    headers: { "Content-Type": "text/xml", "SOAPAction": "", "Authorization": `Bearer ${token}` },
    body: soapBody,
  });
  const text = await res.text();
  const match = text.match(/<rval>(https?:\/\/[^<]+)<\/rval>/);
  return match ? match[1] : null;
}

export async function fetchGamReport(
  shop: string,
  startDate: string,
  endDate: string
): Promise<Array<{
  lineItemId: string;
  lineItemName: string;
  impressions: number;
  clicks: number;
  ctr: number;
  revenue: number;
}>> {
  const reportJobId = await runGamReport(shop, startDate, endDate);
  if (!reportJobId) return [];

  let status = "IN_PROGRESS";
  let attempts = 0;
  while (status === "IN_PROGRESS" && attempts < 10) {
    await new Promise((r) => setTimeout(r, 3000));
    status = await getReportStatus(shop, reportJobId);
    attempts++;
  }
  if (status !== "COMPLETED") return [];

  const downloadUrl = await getReportDownloadURL(shop, reportJobId);
  if (!downloadUrl) return [];

  const csvRes = await fetch(downloadUrl);
  const csvText = await csvRes.text();
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.replace(/"/g, "").trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    results.push({
      lineItemId:   row["Dimension.LINE_ITEM_ID"]              ?? "",
      lineItemName: row["Dimension.LINE_ITEM_NAME"]            ?? "",
      impressions:  parseInt(row["Column.AD_SERVER_IMPRESSIONS"]          ?? "0", 10),
      clicks:       parseInt(row["Column.AD_SERVER_CLICKS"]               ?? "0", 10),
      ctr:          parseFloat(row["Column.AD_SERVER_CTR"]                ?? "0"),
      revenue:      parseFloat(row["Column.AD_SERVER_CPM_AND_CPC_REVENUE"] ?? "0"),
    });
  }
  return results;
}