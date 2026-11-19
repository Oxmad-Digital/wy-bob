export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { listGalleryPhotos } from "@/app/lib/repos/gallery";

export const revalidate = 60;

export async function GET() {
  const photos = await listGalleryPhotos();
  return NextResponse.json({
    photos: photos.map((p) => ({ _id: p._id, url: p.url })),
  });
}
