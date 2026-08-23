import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import GalleryPhoto from "@/app/models/GalleryPhoto";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user?.role !== "admin") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  await connectDB();
  const photos = await GalleryPhoto.find({}).sort({ order: 1, createdAt: 1 }).lean();
  return NextResponse.json({
    success: true,
    photos: photos.map(p => ({ _id: p._id.toString(), url: p.url, publicId: p.publicId, order: p.order, alt: p.alt ?? null })),
  });
}

export async function POST(request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { url, publicId } = await request.json();
  if (!url) return NextResponse.json({ error: "URL manquante" }, { status: 400 });

  await connectDB();
  const count = await GalleryPhoto.countDocuments();
  const photo = await GalleryPhoto.create({ url, publicId: publicId ?? null, order: count });
  return NextResponse.json({ success: true, photo: { _id: photo._id.toString(), url: photo.url } }, { status: 201 });
}

export async function PATCH(request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { orderedIds } = await request.json();
  if (!Array.isArray(orderedIds)) return NextResponse.json({ error: "orderedIds manquant" }, { status: 400 });

  await connectDB();
  await Promise.all(orderedIds.map((id, index) => GalleryPhoto.findByIdAndUpdate(id, { order: index })));
  return NextResponse.json({ success: true });
}
