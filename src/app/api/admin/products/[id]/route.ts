import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { updateProduct } from "@/app/lib/repos/products";

type Ctx = { params: Promise<{ id: string }> };

// Met à jour les infos générales et/ou les variantes
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const patch: Record<string, unknown> = {};
  if (body.name        !== undefined) patch.name       = body.name;
  if (body.price       !== undefined) patch.price      = Number(body.price);
  if (body.pricePromo  !== undefined) patch.pricePromo = body.pricePromo ? Number(body.pricePromo) : null;
  if (body.stock       !== undefined) patch.stock      = Number(body.stock);
  if (body.visible     !== undefined) patch.visible    = Boolean(body.visible);
  if (body.weight      !== undefined) patch.weight     = Number(body.weight);
  if (body.variants    !== undefined) patch.variants   = body.variants;

  const product = await updateProduct(id, patch);
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    product: {
      _id:        product._id.toString(),
      name:       product.name,
      price:      product.price,
      pricePromo: product.pricePromo ?? null,
      stock:      product.stock,
      visible:    product.visible,
      weight:     product.weight ?? 100,
      variants:   product.variants.map((v: any) => ({
        _id:         v._id?.toString(),
        colorName:   v.colorName,
        colorCode:   v.colorCode,
        textColor:   v.textColor,
        description: v.description,
        image:       v.image,
        stock:       v.stock ?? 0,
        editionSize: v.editionSize ?? 50,
      })),
    },
  });
}
