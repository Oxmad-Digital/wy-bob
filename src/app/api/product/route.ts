import { NextResponse } from "next/server";
import { findFirstProduct, createProduct, setProductVariants } from "@/app/lib/repos/products";

export const revalidate = 60;

const DEFAULT_PRODUCT = {
  name:     "WYBOB Essentials",
  price:    85,
  stock:    0,
  visible:  true,
  variants: [
    { colorName: "Bleu",  colorCode: "#1B2D5E", textColor: "#ffffff", image: "/images/wybob_bleu.webp"  },
    { colorName: "Blanc", colorCode: "#f5f5f0", textColor: "#1B1843", image: "/images/wybob_blanc.webp" },
    { colorName: "Jaune", colorCode: "#e6a817", textColor: "#1B1843", image: "/images/wybob_jaune.webp" },
    { colorName: "Rouge", colorCode: "#c0392b", textColor: "#ffffff", image: "/images/wybob_rouge.webp" },
  ],
};

export async function GET() {
  let product: any = await findFirstProduct();

  if (!product) {
    product = await createProduct(DEFAULT_PRODUCT);
  } else if (!product.variants?.length) {
    product = await setProductVariants(product._id, DEFAULT_PRODUCT.variants);
  }

  const p = product;

  return NextResponse.json({
    success: true,
    product: {
      _id:        p._id.toString(),
      name:       p.name,
      price:      p.price,
      pricePromo: p.pricePromo ?? null,
      stock:      p.stock,
      visible:    p.visible,
      variants:   (p.variants ?? []).map((v: any) => ({
        _id:         v._id?.toString(),
        colorName:   v.colorName,
        colorCode:   v.colorCode,
        textColor:   v.textColor,
        description: v.description,
        image:       v.image,
        stock:       v.stock ?? 0,
      })),
    },
  });
}
