import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { adjustProductStock } from "@/app/lib/repos/products";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { delta } = await req.json();
    if (typeof delta !== "number") {
      return NextResponse.json({ error: "delta manquant" }, { status: 400 });
    }

    const { id } = await params;

    const stock = await adjustProductStock(id, delta);
    if (stock === null) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    return NextResponse.json({ stock });
  } catch (err) {
    console.error("[stock PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
