import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  findUserByEmail,
  listUserAddresses,
  addUserAddress,
  deleteUserAddressAtIndex,
} from "@/app/lib/repos/users";

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const user = await findUserByEmail(session.user.email);
    return NextResponse.json({ addresses: user ? await listUserAddresses(user.id) : [] });
  } catch (error) {
    console.error("GET USER ADDRESSES ERROR:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await req.json();
    const { label, fullName, street, zip, city, country } = body;

    if (!fullName || !street || !zip || !city || !country) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }

    const user = await findUserByEmail(session.user.email);
    if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

    const addresses = await addUserAddress(user.id, { label, fullName, street, zip, city, country });
    return NextResponse.json({ addresses });
  } catch (error) {
    console.error("POST USER ADDRESS ERROR:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { index } = await req.json();

    const user = await findUserByEmail(session.user.email);
    if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

    const addresses = await deleteUserAddressAtIndex(user.id, index);
    return NextResponse.json({ addresses });
  } catch (error) {
    console.error("DELETE USER ADDRESS ERROR:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
