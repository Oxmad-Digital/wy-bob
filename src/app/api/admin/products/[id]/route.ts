import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import Product from "@/app/models/Product";

type Ctx = { params: Promise<{ id: string }> };

// Met à jour les infos générales et/ou les variantes
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  await connectDB();
  const product = await Product.findById(id);
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  if (body.name        !== undefined) product.name       = body.name;
  if (body.price       !== undefined) product.price      = Number(body.price);
  if (body.pricePromo  !== undefined) product.pricePromo = body.pricePromo ? Number(body.pricePromo) : null;
  if (body.stock       !== undefined) product.stock      = Number(body.stock);
  if (body.visible     !== undefined) product.visible    = Boolean(body.visible);
  if (body.variants    !== undefined) product.variants   = body.variants;

  await product.save();

  return NextResponse.json({
    success: true,
    product: {
      _id:        product._id.toString(),
      name:       product.name,
      price:      product.price,
      pricePromo: product.pricePromo ?? null,
      stock:      product.stock,
      visible:    product.visible,
      variants:   product.variants.map((v: any) => ({
        _id:         v._id?.toString(),
        colorName:   v.colorName,
        colorCode:   v.colorCode,
        textColor:   v.textColor,
        description: v.description,
        image:       v.image,
      })),
    },
  });
}
