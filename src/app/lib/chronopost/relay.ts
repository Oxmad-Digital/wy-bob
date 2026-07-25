import { getRequest, CHRONOPOST_URLS, ChronopostError, type XmlNode } from "./client";
import type { RelayPoint } from "./types";

export interface SearchRelayPointsParams {
  address: string;
  zipCode: string;
  city: string;
  countryCode: string; // ISO2
  productCode: string; // "86" (Chrono Relais 13, FR) ou "49" (Chronorelais Europe)
  weightGrams?: number;
  maxPoints?: number;
  maxDistanceKm?: number;
}

function toArray(value: XmlNode | XmlNode[] | undefined): XmlNode[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function tomorrowFrFormat(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * recherchePointChronopostInterParService est la seule variante de recherche de
 * points relais documentée comme accessible en GET (chapitre 2.4.2.b3 de la doc) —
 * recherchePointChronopostInter (sans "ParService") est SOAP uniquement.
 * serviceList=100 ("Retrait") correspond au cas d'usage client final qui vient
 * retirer son colis.
 *
 * `shippingDate` n'est pas marqué obligatoire dans la doc mais son absence fait
 * échouer l'appel avec une SOAP Fault générique pour les productCode de type Relais
 * (86, 49) — vérifié empiriquement contre le compte de test.
 */
export async function searchRelayPoints(params: SearchRelayPointsParams): Promise<RelayPoint[]> {
  const parsed = await getRequest(CHRONOPOST_URLS.relay, "recherchePointChronopostInterParService", {
    address: params.address,
    zipCode: params.zipCode,
    city: params.city,
    countryCode: params.countryCode,
    type: "P",
    productCode: params.productCode,
    service: "L",
    serviceList: "100",
    weight: params.weightGrams ?? 500,
    shippingDate: tomorrowFrFormat(),
    maxPointChronopost: params.maxPoints ?? 8,
    maxDistanceSearch: params.maxDistanceKm ?? 20,
    holidayTolerant: 1,
    language: "FR",
    version: "2.0",
  });

  const body = parsed?.Envelope?.Body;
  const responseNode = body?.recherchePointChronopostInterParServiceResponse;
  const result = responseNode?.return ?? responseNode;

  // Code 601 = le filtre de distance n'a laissé aucun point relais (rayon de recherche
  // trop petit pour la zone) — un résultat vide légitime, pas une panne du service.
  if (Number(result?.errorCode) === 601) {
    return [];
  }

  if (result?.errorCode !== undefined && Number(result.errorCode) !== 0) {
    throw new ChronopostError(
      result.errorMessage || `Erreur recherche points relais (code ${result.errorCode})`,
      result.errorCode
    );
  }

  const points = toArray(result?.listePointRelais);

  return points
    .filter((p: XmlNode) => String(p?.actif) !== "false")
    .map(
      (p: XmlNode): RelayPoint => ({
        id: String(p.identifiant ?? ""),
        name: String(p.nom ?? ""),
        address1: String(p.adresse1 ?? ""),
        address2: p.adresse2 ? String(p.adresse2) : undefined,
        zipCode: String(p.codePostal ?? ""),
        city: String(p.localite ?? ""),
        country: String(p.codePays ?? params.countryCode),
        distanceInMeters: p.distanceEnMetre !== undefined ? Number(p.distanceEnMetre) : undefined,
        latitude: p.coordGeolocalisationLatitude !== undefined ? Number(p.coordGeolocalisationLatitude) : undefined,
        longitude: p.coordGeolocalisationLongitude !== undefined ? Number(p.coordGeolocalisationLongitude) : undefined,
      })
    )
    .filter((p) => p.id);
}
