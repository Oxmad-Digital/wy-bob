export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createGalleryPhoto, listGalleryPhotos, reorderGalleryPhotos } from "@/app/lib/repos/gallery";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user?.role !== "admin") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const photos = await listGalleryPhotos();
    return NextResponse.json({
      success: true,
      photos: photos.map((p) => ({ _id: p._id, url: p.url, publicId: p.publicId, order: p.order, alt: p.alt ?? null })),
    });
  } catch (error) {
    console.error("GET ADMIN GALLERY ERROR:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const { url, publicId } = await request.json();
    if (!url) return NextResponse.json({ error: "URL manquante" }, { status: 400 });

    const photo = await createGalleryPhoto({ url, publicId: publicId ?? null });
    return NextResponse.json({ success: true, photo: { _id: photo._id, url: photo.url } }, { status: 201 });
  } catch (error) {
    console.error("POST ADMIN GALLERY ERROR:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const { orderedIds } = await request.json();
    if (!Array.isArray(orderedIds)) return NextResponse.json({ error: "orderedIds manquant" }, { status: 400 });

    await reorderGalleryPhotos(orderedIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH ADMIN GALLERY ERROR:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
