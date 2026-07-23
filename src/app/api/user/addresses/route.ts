import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/app/lib/db";
import User from "@/app/models/User";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  await connectDB();

  const user = await User.findOne({ email: session.user.email }).lean();
  return NextResponse.json({ addresses: user?.addresses ?? [] });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { label, fullName, street, zip, city, country } = body;

  if (!fullName || !street || !zip || !city || !country) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }

  await connectDB();

  const user = await User.findOneAndUpdate(
    { email: session.user.email },
    { $push: { addresses: { label, fullName, street, zip, city, country } } },
    { new: true }
  );

  return NextResponse.json({ addresses: user.addresses });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { index } = await req.json();

  await connectDB();

  const user = await User.findOne({ email: session.user.email });
  user.addresses.splice(index, 1);
  await user.save();

  return NextResponse.json({ addresses: user.addresses });
}