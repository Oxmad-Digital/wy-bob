import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import Product from "@/app/models/Product";

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
    variants:   (product.variants ?? []).map((v: any) => ({
      _id:         v._id?.toString(),
      colorName:   v.colorName,
      colorCode:   v.colorCode,
      textColor:   v.textColor,
      description: v.description,
      image:       v.image,
    })),
  };
}

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  await connectDB();
  let product = await Product.findOne({}).sort({ _id: 1 }).lean() as any;

  if (!product) {
    product = (await Product.create({
      name: "WYBOB Essentials", price: 85, stock: 0, visible: true,
      variants: DEFAULT_VARIANTS,
    })).toObject();
  } else if (!product.variants?.length) {
    await Product.updateOne({ _id: product._id }, { $set: { variants: DEFAULT_VARIANTS } });
    product = await Product.findById(product._id).lean() as any;
  }

  return NextResponse.json({ success: true, product: serialize(product) });
}
