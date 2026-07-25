export type DeliveryMethod = "home" | "relay";
export type BusinessType = "BtoC" | "BtoB";

export interface ShipmentParty {
  name: string;
  name2?: string;
  contactName?: string;
  address1: string;
  address2?: string;
  zipCode: string;
  city: string;
  country: string; // ISO2
  countryName: string;
  phone?: string;
  mobilePhone?: string;
  email?: string;
  civility?: "M" | "MME";
}

export interface CreateShipmentInput {
  recipient: ShipmentParty;
  recipientPickupName?: string; // personne habilitée à retirer le colis (point relais)
  shipperRef?: string;
  recipientRef?: string;
  weightKg: number;
  relayId?: string;
  deliveryMethod: DeliveryMethod;
  saturday?: boolean;
  businessType?: BusinessType;
  productKeyOverride?: string;
  content1?: string; // description douanière anglaise, international uniquement
}

export interface CreateShipmentResult {
  skybillNumber: string;
  labelBase64: string;
  productCode: string;
  productKey: string;
  service: string;
  serviceName?: string;
  rawRequestXml: string;
  rawResponseXml: string;
}

export interface RelayPoint {
  id: string;
  name: string;
  address1: string;
  address2?: string;
  zipCode: string;
  city: string;
  country: string;
  distanceInMeters?: number;
  latitude?: number;
  longitude?: number;
}

export interface TrackingEvent {
  code?: string;
  label?: string;
  date?: string;
  site?: string;
}

export interface TrackingResult {
  skybillNumber: string;
  statusCode?: string;
  statusLabel?: string;
  events: TrackingEvent[];
}
