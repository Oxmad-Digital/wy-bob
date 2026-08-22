import { XMLParser } from "fast-xml-parser";

// La forme exacte du XML Chronopost varie par opération — on la garde dynamique
// plutôt que de modéliser chaque réponse possible.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type XmlNode = any;

export const CHRONOPOST_URLS = {
  shipping: "https://ws.chronopost.fr/shipping-cxf/ShippingServiceWS",
  tracking: "https://ws.chronopost.fr/tracking-cxf/TrackingServiceWS",
  relay: "https://ws.chronopost.fr/recherchebt-ws-cxf/PointRelaisServiceWS",
};

const xmlParser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true });

export class ChronopostError extends Error {
  code?: string | number;
  constructor(message: string, code?: string | number) {
    super(message);
    this.name = "ChronopostError";
    this.code = code;
  }
}

function assertCredentials() {
  if (!process.env.CHRONOPOST_ACCOUNT_NUMBER || !process.env.CHRONOPOST_PASSWORD) {
    throw new ChronopostError(
      "Identifiants Chronopost manquants (CHRONOPOST_ACCOUNT_NUMBER / CHRONOPOST_PASSWORD)"
    );
  }
}

export function chronopostCredentials() {
  assertCredentials();
  return {
    accountNumber: process.env.CHRONOPOST_ACCOUNT_NUMBER!,
    password: process.env.CHRONOPOST_PASSWORD!,
    subAccount: process.env.CHRONOPOST_SUBACCOUNT || "",
  };
}

/**
 * Appel SOAP (POST XML) — utilisé par shippingMultiParcelV4 (ShippingServiceWS) ainsi
 * que par trackSkybillV2/trackSearch (TrackingServiceWS), qui contrairement à
 * searchPOD/cancelListSkybill ne sont pas documentés comme accessibles en GET.
 */
export async function soapRequest(
  url: string,
  operation: string,
  envelopeXml: string
): Promise<{ result: XmlNode; rawResponseXml: string }> {
  assertCredentials();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "",
    },
    body: envelopeXml,
  });

  const rawResponseXml = await res.text();

  if (!res.ok) {
    throw new ChronopostError(`Erreur HTTP Chronopost (${res.status}): ${rawResponseXml.slice(0, 500)}`);
  }

  const parsed = xmlParser.parse(rawResponseXml);
  const body = parsed?.Envelope?.Body;
  const fault = body?.Fault;
  if (fault) {
    throw new ChronopostError(fault.faultstring || "Erreur SOAP Chronopost", fault.faultcode);
  }

  const responseNode = body?.[`${operation}Response`];
  const result = responseNode?.return ?? responseNode;

  if (result?.errorCode !== undefined && Number(result.errorCode) !== 0) {
    throw new ChronopostError(
      result.errorMessage || `Erreur Chronopost (code ${result.errorCode})`,
      result.errorCode
    );
  }

  return { result, rawResponseXml };
}

/**
 * Appel GET — utilisé par recherchePointChronopostInterParService, searchPOD et
 * cancelListSkybill, seuls services documentés comme accessibles en simple query string.
 */
export async function getRequest(
  baseUrl: string,
  operation: string,
  params: Record<string, string | number | undefined>
): Promise<XmlNode> {
  const { accountNumber, password } = chronopostCredentials();
  const query = new URLSearchParams({ accountNumber, password });

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }

  const url = `${baseUrl}/${operation}?${query.toString()}`;
  const res = await fetch(url);
  const rawResponseXml = await res.text();

  if (!res.ok) {
    throw new ChronopostError(`Erreur HTTP Chronopost (${res.status}): ${rawResponseXml.slice(0, 500)}`);
  }

  return xmlParser.parse(rawResponseXml);
}
