import type { BusinessType, DeliveryMethod } from "./types";

// Codes produit/service — cahier des charges Chronopost transmis par la cliente (contrat 17895404)
export const FR_PRODUCTS = {
  CHRONO_10: { productCode: "02", label: "Chrono 10" },
  CHRONO_13: { productCode: "01", label: "Chrono 13" },
  CHRONO_RELAIS_13: { productCode: "86", label: "Chrono Relais 13" },
} as const;

export const INTL_PRODUCTS = {
  CHRONO_CLASSIC_BTOC: { productCode: "44", label: "Chrono Classic BtoC", serviceLight: "328", serviceHeavy: "327" },
  CHRONO_CLASSIC_BTOB: { productCode: "44", label: "Chrono Classic BtoB", serviceLight: "136", serviceHeavy: "101" },
  CHRONO_RELAIS_EUROPE: { productCode: "49", label: "Chronorelais Europe", serviceLight: "338", serviceHeavy: "337" },
  CHRONO_EXPRESS: { productCode: "17", label: "Chrono Express", service: "0" },
} as const;

export type FrProductKey = keyof typeof FR_PRODUCTS;
export type IntlProductKey = keyof typeof INTL_PRODUCTS;

const WEIGHT_THRESHOLD_KG = 3;

export interface ProductServiceResolution {
  productKey: FrProductKey | IntlProductKey;
  productCode: string;
  service: string;
  label: string;
  isDomestic: boolean;
}

export function resolveProductAndService(params: {
  country: string;
  deliveryMethod: DeliveryMethod;
  totalWeightKg: number;
  saturday?: boolean;
  businessType?: BusinessType;
  productKeyOverride?: string;
}): ProductServiceResolution {
  const { country, deliveryMethod, totalWeightKg, saturday = false, businessType = "BtoC", productKeyOverride } = params;
  const isDomestic = (country || "").toUpperCase() === "FR";

  if (isDomestic) {
    const key: FrProductKey =
      productKeyOverride && productKeyOverride in FR_PRODUCTS
        ? (productKeyOverride as FrProductKey)
        : deliveryMethod === "relay"
        ? "CHRONO_RELAIS_13"
        : "CHRONO_13";
    const product = FR_PRODUCTS[key];
    return {
      productKey: key,
      productCode: product.productCode,
      service: saturday ? "6" : "0",
      label: product.label,
      isDomestic: true,
    };
  }

  const key: IntlProductKey =
    productKeyOverride && productKeyOverride in INTL_PRODUCTS
      ? (productKeyOverride as IntlProductKey)
      : deliveryMethod === "relay"
      ? "CHRONO_RELAIS_EUROPE"
      : businessType === "BtoB"
      ? "CHRONO_CLASSIC_BTOB"
      : "CHRONO_CLASSIC_BTOC";
  const product = INTL_PRODUCTS[key];

  if (key === "CHRONO_EXPRESS") {
    return {
      productKey: key,
      productCode: product.productCode,
      service: (product as typeof INTL_PRODUCTS.CHRONO_EXPRESS).service,
      label: product.label,
      isDomestic: false,
    };
  }

  const heavy = totalWeightKg > WEIGHT_THRESHOLD_KG;
  const withWeight = product as typeof INTL_PRODUCTS.CHRONO_CLASSIC_BTOC;
  return {
    productKey: key,
    productCode: product.productCode,
    service: heavy ? withWeight.serviceHeavy : withWeight.serviceLight,
    label: product.label,
    isDomestic: false,
  };
}
