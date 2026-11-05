import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findFirstProduct, createProduct, setProductVariants } from "@/app/lib/repos/products";

const DEFAULT_VARIANTS = [
  { colorName: "Bleu",  colorCode: "#1B2D5E", textColor: "#ffffff", image: "/images/wybob_bleu.webp"  },
  { colorName: "Blanc", colorCode: "#f5f5f0", textColor: "#1B1843", image: "/images/wybob_blanc.webp" },
  { colorName: "Jaune", colorCode: "#e6a817", textColor: "#1B1843", image: "/images/wybob_jaune.webp" },
  { colorName: "Rouge", colorCode: "#c0392b", textColor: "#ffffff", image: "/images/wybob_rouge.webp" },
];

function serialize(product: any) {
  return {
    _id:        product._id.toString(),
    name:       product.name,
    price:      product.price,
    pricePromo: product.pricePromo ?? null,
    stock:      product.stock,
    visible:    product.visible,
    weight:     product.weight ?? 100,
    variants:   (product.variants ?? []).map((v: any) => ({
      _id:         v._id?.toString(),
      colorName:   v.colorName,
      colorCode:   v.colorCode,
      textColor:   v.textColor,
      description: v.description,
      image:       v.image,
      stock:       v.stock ?? 0,
      editionSize: v.editionSize ?? 50,
    })),
  };
}

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let product: any = await findFirstProduct();

  if (!product) {
    product = await createProduct({
      name: "WYBOB Essentials", price: 85, stock: 0, visible: true,
      variants: DEFAULT_VARIANTS,
    });
  } else if (!product.variants?.length) {
    product = await setProductVariants(product._id, DEFAULT_VARIANTS);
  }

  return NextResponse.json({ success: true, product: serialize(product) });
}
