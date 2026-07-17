import { soapRequest, getRequest, chronopostCredentials, CHRONOPOST_URLS, ChronopostError, type XmlNode } from "./client";
import { escapeXml } from "./xml";
import type { TrackingEvent, TrackingResult } from "./types";

function toArray(value: XmlNode | XmlNode[] | undefined): XmlNode[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function mapEvents(rawEvents: XmlNode | XmlNode[] | undefined): TrackingEvent[] {
  return toArray(rawEvents).map((e: XmlNode) => ({
    code: e.code !== undefined ? String(e.code) : undefined,
    label: e.eventLabel !== undefined ? String(e.eventLabel) : undefined,
    date: e.eventDate !== undefined ? String(e.eventDate) : undefined,
    site: e.officeLabel !== undefined ? String(e.officeLabel) : undefined,
  }));
}

/**
 * trackSkybillV2 — suivi d'un colis par son numéro de lettre de transport.
 * Contrairement à searchPOD/cancelListSkybill, ce service n'est pas documenté comme
 * accessible en GET : c'est un appel SOAP classique sur TrackingServiceWS.
 */
export async function trackParcel(skybillNumber: string, language = "fr_FR"): Promise<TrackingResult> {
  const { accountNumber, password } = chronopostCredentials();

  const envelopeXml = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cxf="http://cxf.tracking.soap.chronopost.fr/">
   <soapenv:Header/>
   <soapenv:Body>
      <cxf:trackSkybillV2>
         <accountNumber>${escapeXml(accountNumber)}</accountNumber>
         <password>${escapeXml(password)}</password>
         <language>${escapeXml(language)}</language>
         <skybillNumber>${escapeXml(skybillNumber)}</skybillNumber>
      </cxf:trackSkybillV2>
   </soapenv:Body>
</soapenv:Envelope>`;

  const { result } = await soapRequest(CHRONOPOST_URLS.tracking, "trackSkybillV2", envelopeXml);

  const info = result?.listEventInfoComp;
  const rawEvents = toArray(info?.events);
  const events = mapEvents(rawEvents);
  // "L'événement à true [highPriority] est le dernier de la liste" — reflète l'état courant du colis
  const currentIndex = rawEvents.findIndex((e: XmlNode) => String(e?.highPriority) === "true");
  const current = events[currentIndex] ?? events[events.length - 1];

  return {
    skybillNumber: String(info?.skybillNumber ?? skybillNumber),
    statusCode: current?.code,
    statusLabel: current?.label,
    events,
  };
}

/**
 * searchPOD — preuve de livraison (POD). Documenté comme accessible en GET
 * (chapitre 2.6.2.c de la doc).
 */
export async function searchPOD(
  skybillNumber: string,
  opts: { pdf?: boolean; language?: string } = {}
): Promise<{ available: boolean; format?: string; base64?: string; statusCode?: string }> {
  const parsed = await getRequest(CHRONOPOST_URLS.tracking, "searchPOD", {
    language: opts.language ?? "fr_FR",
    pdf: opts.pdf === false ? "false" : "true",
    skybillNumber,
  });

  const body = parsed?.Envelope?.Body;
  const responseNode = body?.searchPODResponse;
  const result = responseNode?.return ?? responseNode;

  if (result?.errorCode !== undefined && Number(result.errorCode) !== 0) {
    throw new ChronopostError(result.errorMessage || `Erreur POD (code ${result.errorCode})`, result.errorCode);
  }

  return {
    available: String(result?.podPresente) === "true",
    format: result?.formatPOD ? String(result.formatPOD) : undefined,
    base64: result?.pod ? String(result.pod) : undefined,
    statusCode: result?.statusCode !== undefined ? String(result.statusCode) : undefined,
  };
}
