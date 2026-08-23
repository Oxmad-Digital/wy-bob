import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import GalleryPhoto from "@/app/models/GalleryPhoto";

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  await connectDB();
  const deleted = await GalleryPhoto.findByIdAndDelete(id);
  if (!deleted) return NextResponse.json({ error: "Photo introuvable" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session || session.user?.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const { alt } = await request.json();

  await connectDB();
  const updated = await GalleryPhoto.findByIdAndUpdate(id, { alt: alt || null }, { new: true }).lean();
  if (!updated) return NextResponse.json({ error: "Photo introuvable" }, { status: 404 });
  return NextResponse.json({ success: true, photo: { _id: updated._id.toString(), alt: updated.alt ?? null } });
}
