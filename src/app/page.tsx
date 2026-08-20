import { connectDB } from '@/app/lib/db'
import Product from '@/app/models/Product'
import HomeClient from './HomeClient'

export const revalidate = 60

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
        })),
      }
    }
  } catch {
    // HomeClient utilisera les FALLBACK_VARIANTS
  }

  return <HomeClient product={productData} />
}
