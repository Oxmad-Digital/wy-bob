import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import GalleryPhoto from "@/app/models/GalleryPhoto";

export const revalidate = 60;

export async function GET() {
  await connectDB();
  const photos = await GalleryPhoto.find({}).sort({ order: 1, createdAt: 1 }).lean();
  return NextResponse.json({
    photos: photos.map(p => ({ _id: p._id.toString(), url: p.url })),
  });
}
