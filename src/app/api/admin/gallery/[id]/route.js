export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteGalleryPhoto, updateGalleryPhotoAlt } from "@/app/lib/repos/gallery";

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const deleted = await deleteGalleryPhoto(id);
    if (!deleted) return NextResponse.json({ error: "Photo introuvable" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE ADMIN GALLERY PHOTO ERROR:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { alt } = await request.json();

    const updated = await updateGalleryPhotoAlt(id, alt);
    if (!updated) return NextResponse.json({ error: "Photo introuvable" }, { status: 404 });
    return NextResponse.json({ success: true, photo: { _id: updated._id, alt: updated.alt ?? null } });
  } catch (error) {
    console.error("PATCH ADMIN GALLERY PHOTO ERROR:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
