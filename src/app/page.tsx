import type { Metadata } from 'next'
import { connectDB } from '@/app/lib/db'
import Product from '@/app/models/Product'
import HomeClient from './HomeClient'

export const revalidate = 60

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wybob.shop'

export default async function Home() {
  let productData = null

  try {
    await connectDB()
    const doc = await Product.findOne({}).lean() as any

    if (doc) {
      productData = {
        _id:        doc._id.toString(),
        name:       doc.name,
        price:      doc.price,
        pricePromo: doc.pricePromo ?? null,
        stock:      doc.stock,
        visible:    doc.visible,
        variants:   (doc.variants ?? []).map((v: any) => ({
          _id:         v._id?.toString() ?? '',
          colorName:   v.colorName,
          colorCode:   v.colorCode,
          textColor:   v.textColor,
          description: v.description,
          image:       v.image,
          stock:       v.stock ?? 0,
          editionSize: v.editionSize ?? 50,
        })),
      }
    }
  } catch {
    // HomeClient utilisera les FALLBACK_VARIANTS
  }

  const productJsonLd = productData
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: productData.name,
        image: productData.variants.map((v: any) => (v.image.startsWith('http') ? v.image : `${siteUrl}${v.image}`)),
        description: 'Bob premium fait main en 100% coton bio, façonné par des artisans à Madagascar.',
        brand: { '@type': 'Brand', name: 'WYBOB' },
        offers: productData.variants.length
          ? productData.variants.map((v: any) => ({
              '@type': 'Offer',
              url: siteUrl,
              priceCurrency: 'EUR',
              price: productData!.pricePromo ?? productData!.price,
              availability: v.stock && v.stock > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
              itemCondition: 'https://schema.org/NewCondition',
            }))
          : {
              '@type': 'Offer',
              url: siteUrl,
              priceCurrency: 'EUR',
              price: productData.pricePromo ?? productData.price,
              availability: productData.stock > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
              itemCondition: 'https://schema.org/NewCondition',
            },
      }
    : null

  return (
    <>
      {productJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      )}
      <HomeClient product={productData} />
    </>
  )
}
