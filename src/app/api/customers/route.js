import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  listCustomersWithAccounts,
  customerEmailExists,
  createCustomer,
  CustomerExistsError,
  syncCustomersFromOrdersAndUsers,
} from "@/app/lib/repos/customers";

const ALLOWED_SORT_FIELDS = new Set([
  "createdAt", "updatedAt", "totalOrders", "totalSpent",
  "lastOrderAt", "firstname", "lastname", "email",
]);

/* =========================
   GET - Liste des clients
========================= */
export async function GET(req) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search    = searchParams.get("search") || "";
    const status    = searchParams.get("status") || "";
    const sortField = ALLOWED_SORT_FIELDS.has(searchParams.get("sort"))
      ? searchParams.get("sort")
      : "createdAt";
    const sortDir = searchParams.get("order") === "asc" ? 1 : -1;
    const page    = Math.max(1, parseInt(searchParams.get("page"))  || 1);
    const limit   = Math.min(100, parseInt(searchParams.get("limit")) || 20);

    // Comptes (users) joints à leur fiche CRM (customers) par email, champs fusionnés,
    // filtrés, triés et paginés : voir listCustomersWithAccounts.
    const { customers, total } = await listCustomersWithAccounts({
      search, status, sortField, sortDir, page, limit,
    });
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      success: true,
      customers,
      pagination: { total, page, limit, totalPages },
    });
  } catch (error) {
    console.error("GET CUSTOMERS ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/* =========================
   POST - Create / Sync
========================= */
export async function POST(req) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const body = await req.json();

    if (body.action === "sync") {
      return await syncCustomersFromOrders();
    }

    const { firstname, lastname, email, phone, city, address } = body;

    if (await customerEmailExists(email.toLowerCase())) {
      return NextResponse.json(
        { success: false, message: "Ce client existe déjà" },
        { status: 400 }
      );
    }

    const customer = await createCustomer({
      firstname,
      lastname,
      email: email.toLowerCase(),
      phone,
      city,
      address,
    });

    return NextResponse.json(
      { success: true, customer },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof CustomerExistsError) {
      return NextResponse.json(
        { success: false, message: "Ce client existe déjà" },
        { status: 400 }
      );
    }
    console.error("POST CUSTOMER ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/* =========================
   SYNC CLIENTS (PRO & SAFE)
========================= */
async function syncCustomersFromOrders() {
  try {
    // Commandes agrégées par email + comptes non admin sans commande, upsert par email :
    // voir syncCustomersFromOrdersAndUsers.
    const { created, updated } = await syncCustomersFromOrdersAndUsers();

    return NextResponse.json({
      success: true,
      message: `Synchronisation terminée — ${created} créés, ${updated} mis à jour`,
      created,
      updated,
      total: created + updated,
    });
  } catch (error) {
    console.error("SYNC CUSTOMER ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Erreur serveur" },
      { status: 500 }
    );
  }
}
