import type { Metadata } from 'next'
import { connectDB } from '@/app/lib/db'
import Product from '@/app/models/Product'
import { computeShippingFee } from '@/app/lib/shipping/pricing'
import { computeTotalWeightKg } from '@/app/lib/shipping/weight'
import { buildProductJsonLd, serializeJsonLd } from '@/app/lib/productJsonLd'
import HomeClient from './HomeClient'

export const revalidate = 60

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wybob.shop'

export default async function Home() {
  let productData = null
  let shippingFeeFR = 0

  try {
    await connectDB()
    const doc = await Product.findOne({}).lean() as any

    if (doc) {
      shippingFeeFR = computeShippingFee({
        country: 'FR',
        weightKg: computeTotalWeightKg([{ product: doc, quantity: 1 }]),
        deliveryMethod: 'home',
      })

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
    ? buildProductJsonLd(productData, siteUrl, shippingFeeFR)
    : null

  return (
    <>
      {productJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd) }}
        />
      )}
      <HomeClient product={productData} />
    </>
  )
}
