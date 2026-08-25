import fs from "fs";
import path from "path";
import { escapeXml } from "./xml";
import { soapRequest, ChronopostError, chronopostCredentials, CHRONOPOST_URLS } from "./client";
import { resolveProductAndService } from "./constants";
import type { CreateShipmentInput, CreateShipmentResult, ShipmentParty } from "./types";

const OBJECT_TYPE = "MAR"; // marchandise
const EVT_CODE = "DC";

function shipperFromEnv(): ShipmentParty {
  return {
    name: process.env.CHRONOPOST_SHIPPER_NAME || "",
    contactName: process.env.CHRONOPOST_SHIPPER_CONTACT_NAME || "",
    address1: process.env.CHRONOPOST_SHIPPER_ADDRESS1 || "",
    address2: process.env.CHRONOPOST_SHIPPER_ADDRESS2 || "",
    zipCode: process.env.CHRONOPOST_SHIPPER_ZIPCODE || "",
    city: process.env.CHRONOPOST_SHIPPER_CITY || "",
    country: process.env.CHRONOPOST_SHIPPER_COUNTRY || "FR",
    countryName: process.env.CHRONOPOST_SHIPPER_COUNTRY_NAME || "FRANCE",
    phone: process.env.CHRONOPOST_SHIPPER_PHONE || "",
    email: process.env.CHRONOPOST_SHIPPER_EMAIL || "",
  };
}

function partyXml(
  prefix: "shipper" | "customer" | "recipient",
  party: ShipmentParty,
  opts: { civility?: boolean; preAlert?: boolean } = {}
): string {
  const lines = [
    `<${prefix}Adress1>${escapeXml(party.address1)}</${prefix}Adress1>`,
    `<${prefix}Adress2>${escapeXml(party.address2)}</${prefix}Adress2>`,
    `<${prefix}City>${escapeXml(party.city)}</${prefix}City>`,
  ];
  if (opts.civility) {
    lines.push(`<${prefix}Civility>${escapeXml(party.civility || "M")}</${prefix}Civility>`);
  }
  lines.push(`<${prefix}ContactName>${escapeXml(party.contactName)}</${prefix}ContactName>`);
  lines.push(`<${prefix}Country>${escapeXml(party.country)}</${prefix}Country>`);
  lines.push(`<${prefix}CountryName>${escapeXml(party.countryName)}</${prefix}CountryName>`);
  lines.push(`<${prefix}Email>${escapeXml(party.email)}</${prefix}Email>`);
  lines.push(`<${prefix}MobilePhone>${escapeXml(party.mobilePhone)}</${prefix}MobilePhone>`);
  lines.push(`<${prefix}Name>${escapeXml(party.name)}</${prefix}Name>`);
  lines.push(`<${prefix}Name2>${escapeXml(party.name2)}</${prefix}Name2>`);
  lines.push(`<${prefix}Phone>${escapeXml(party.phone)}</${prefix}Phone>`);
  if (opts.preAlert) {
    lines.push(`<${prefix}PreAlert>0</${prefix}PreAlert>`);
  }
  lines.push(`<${prefix}ZipCode>${escapeXml(party.zipCode)}</${prefix}ZipCode>`);
  return `<${prefix}Value>\n${lines.join("\n")}\n</${prefix}Value>`;
}

function buildShippingXml(input: CreateShipmentInput, resolved: ReturnType<typeof resolveProductAndService>): string {
  const { accountNumber, password, subAccount } = chronopostCredentials();
  const shipper = shipperFromEnv();

  // recipientValue : si livraison en point relais, les coordonnées du point relais
  // remplacent celles du client final (cf. cahier des charges §2 "Recherche et envoi vers un Pickup Relais")
  const recipient: ShipmentParty =
    input.deliveryMethod === "relay"
      ? {
          ...input.recipient,
          name2: input.recipientPickupName || input.recipient.name2 || input.recipient.contactName,
        }
      : input.recipient;

  const isInternational = !resolved.isDomestic;

  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cxf="http://cxf.shipping.soap.chronopost.fr/">
   <soapenv:Header/>
   <soapenv:Body>
      <cxf:shippingMultiParcelV4>
         <headerValue>
            <accountNumber>${escapeXml(accountNumber)}</accountNumber>
            <idEmit>CHRFR</idEmit>
            <identWebPro></identWebPro>
            <subAccount>${escapeXml(subAccount)}</subAccount>
         </headerValue>
         ${partyXml("shipper", shipper, { civility: true, preAlert: true })}
         ${partyXml("customer", { ...shipper }, { civility: true, preAlert: true })}
         ${partyXml("recipient", recipient, { preAlert: true })}
         <refValue>
            <recipientRef>${escapeXml(input.recipientRef)}</recipientRef>
            <shipperRef>${escapeXml(input.shipperRef)}</shipperRef>
            ${input.deliveryMethod === "relay" ? `<idRelais>${escapeXml(input.relayId)}</idRelais>` : ""}
         </refValue>
         <skybillValue>
            <bulkNumber></bulkNumber>
            <codCurrency></codCurrency>
            <codValue></codValue>
            <content1>${isInternational ? escapeXml(input.content1) : ""}</content1>
            <content2></content2>
            <content3></content3>
            <content4></content4>
            <content5></content5>
            <customsCurrency>${isInternational ? "EUR" : ""}</customsCurrency>
            <customsValue></customsValue>
            <evtCode>${EVT_CODE}</evtCode>
            <insuredCurrency>${input.insuredValue ? "EUR" : ""}</insuredCurrency>
            <insuredValue>${input.insuredValue ?? ""}</insuredValue>
            <latitude></latitude>
            <longitude></longitude>
            <masterSkybillNumber></masterSkybillNumber>
            <objectType>${OBJECT_TYPE}</objectType>
            <portCurrency></portCurrency>
            <portValue></portValue>
            <productCode>${escapeXml(resolved.productCode)}</productCode>
            <qualite></qualite>
            <service>${escapeXml(resolved.service)}</service>
            <shipDate></shipDate>
            <shipHour></shipHour>
            <skybillRank></skybillRank>
            <source></source>
            <weight>${input.weightKg}</weight>
            <weightUnit>KGM</weightUnit>
            <height>1</height>
            <length>1</length>
            <width>1</width>
            <alternateProductCode></alternateProductCode>
         </skybillValue>
         <skybillParamsValue>
            <duplicata>N</duplicata>
            <mode>PDF</mode>
            <withReservation>0</withReservation>
         </skybillParamsValue>
         <password>${escapeXml(password)}</password>
         <modeRetour>2</modeRetour>
         <numberOfParcel>1</numberOfParcel>
         <version>2.0</version>
         <multiParcel>N</multiParcel>
       </cxf:shippingMultiParcelV4>
   </soapenv:Body>
</soapenv:Envelope>`;
}

function logExchange(orderRef: string, requestXml: string, responseXml: string) {
  if (process.env.NODE_ENV === "production") return;
  try {
    const dir = path.join(process.cwd(), "chronopost-logs");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const base = `${stamp}_${orderRef || "shipment"}`;
    fs.writeFileSync(path.join(dir, `${base}_request.xml`), requestXml, "utf8");
    fs.writeFileSync(path.join(dir, `${base}_response.xml`), responseXml, "utf8");
  } catch {
    // Le logging ne doit jamais faire échouer la génération d'étiquette.
  }
}

export async function createShipment(
  input: CreateShipmentInput,
  opts: { country: string; totalWeightKg?: number; orderRef?: string } = { country: "FR" }
): Promise<CreateShipmentResult> {
  const resolved = resolveProductAndService({
    country: opts.country,
    deliveryMethod: input.deliveryMethod,
    totalWeightKg: opts.totalWeightKg ?? input.weightKg,
    saturday: input.saturday,
    businessType: input.businessType,
    productKeyOverride: input.productKeyOverride,
  });

  if (input.deliveryMethod === "relay" && !input.relayId) {
    throw new ChronopostError("Un point relais doit être sélectionné pour une livraison en point relais");
  }
  if (!resolved.isDomestic && !input.content1) {
    throw new ChronopostError(
      "La description douanière (content1) est obligatoire pour un envoi international"
    );
  }

  const requestXml = buildShippingXml(input, resolved);

  let result: Awaited<ReturnType<typeof soapRequest>>["result"];
  let rawResponseXml: string;
  try {
    ({ result, rawResponseXml } = await soapRequest(CHRONOPOST_URLS.shipping, "shippingMultiParcelV4", requestXml));
  } catch (err) {
    logExchange(opts.orderRef || "", requestXml, err instanceof Error ? err.message : String(err));
    throw err;
  }

  logExchange(opts.orderRef || "", requestXml, rawResponseXml);

  const parcel = result?.resultMultiParcelValue;
  if (!parcel?.skybillNumber || !parcel?.pdfEtiquette) {
    throw new ChronopostError("Réponse Chronopost incomplète (skybillNumber ou étiquette manquant)");
  }

  return {
    skybillNumber: String(parcel.skybillNumber),
    labelBase64: String(parcel.pdfEtiquette),
    productCode: resolved.productCode,
    productKey: resolved.productKey,
    service: resolved.service,
    serviceName: parcel.serviceName ? String(parcel.serviceName) : undefined,
    rawRequestXml: requestXml,
    rawResponseXml,
  };
}
