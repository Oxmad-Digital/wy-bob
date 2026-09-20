// JSON-LD schema.org de la fiche produit (home) — un ProductGroup avec une variante par couleur.
// Les conditions de livraison et de retour reprennent les CGV (art. 6 et 8) : à garder alignées.

export interface JsonLdVariant {
  colorName: string
  image: string
  description?: string
  stock?: number
  [extra: string]: unknown
}

export interface JsonLdProduct {
  name: string
  price: number
  pricePromo: number | null
  stock: number
  visible: boolean
  variants: JsonLdVariant[]
  [extra: string]: unknown
}

const PRODUCT_DESCRIPTION = 'Bob premium fait main en 100% coton bio, façonné par des artisans à Madagascar.'

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const availability = (stock: number | undefined) =>
  stock && stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'

export function buildProductJsonLd(product: JsonLdProduct, siteUrl: string, shippingFeeFR: number) {
  // Produit masqué en admin : on ne l'annonce pas aux moteurs de recherche.
  if (!product.visible) return null

  const price = product.pricePromo ?? product.price
  const absolute = (path: string) => (path.startsWith('http') ? path : `${siteUrl}${path}`)

  const shippingDetails = {
    '@type': 'OfferShippingDetails',
    shippingRate: { '@type': 'MonetaryAmount', value: shippingFeeFR, currency: 'EUR' },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'FR' },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      transitTime: { '@type': 'QuantitativeValue', minValue: 3, maxValue: 5, unitCode: 'DAY' },
    },
  }

  const returnPolicy = {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'FR',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 14,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/ReturnShippingFees',
  }

  const offer = (stock: number | undefined) => ({
    '@type': 'Offer',
    url: siteUrl,
    priceCurrency: 'EUR',
    price,
    availability: availability(stock),
    itemCondition: 'https://schema.org/NewCondition',
    shippingDetails,
    hasMerchantReturnPolicy: returnPolicy,
  })

  const base = {
    '@context': 'https://schema.org',
    name: product.name,
    description: PRODUCT_DESCRIPTION,
    brand: { '@type': 'Brand', name: 'WYBOB' },
  }

  if (!product.variants.length) {
    return { ...base, '@type': 'Product', offers: offer(product.stock) }
  }

  const groupId = slugify(product.name)

  return {
    ...base,
    '@type': 'ProductGroup',
    productGroupID: groupId,
    url: siteUrl,
    variesBy: ['https://schema.org/color'],
    hasVariant: product.variants.map((v) => ({
      '@type': 'Product',
      name: `${product.name} — ${v.colorName}`,
      description: v.description || PRODUCT_DESCRIPTION,
      sku: `${groupId}-${slugify(v.colorName)}`,
      color: v.colorName,
      image: absolute(v.image),
      brand: base.brand,
      offers: offer(v.stock),
    })),
  }
}

// `<` échappé pour éviter qu'une valeur issue de la base ne referme la balise <script>.
export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c')
