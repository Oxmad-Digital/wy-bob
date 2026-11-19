import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  findCustomerById,
  updateCustomer,
  upsertCustomerForEmail,
  deleteOrAnonymizeCustomer,
} from "@/app/lib/repos/customers";
import { findUserSummaryById } from "@/app/lib/repos/users";
import { listOrdersByCustomerEmail } from "@/app/lib/repos/orders";

// GET - Détails d'un client
export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.id;

    // Id mal formé : findCustomerById et findUserSummaryById renvoient null -> 404.
    const customer = await findCustomerById(id);

    // Fallback : l'id peut être un User._id (utilisateurs sans fiche Customer)
    if (!customer) {
      const user = await findUserSummaryById(id);
      if (!user) {
        return NextResponse.json(
          { success: false, message: "Client non trouvé dans la base" },
          { status: 404 }
        );
      }

      const nameParts = (user.name || "").trim().split(" ");
      const orders = await listOrdersByCustomerEmail(user.email);

      const pseudoCustomer = {
        _id: user._id,
        firstname: nameParts[0] || "",
        lastname: nameParts.slice(1).join(" ") || "",
        email: user.email,
        phone: user.phone || "",
        city: user.address?.city || "",
        address: user.address?.street || "",
        status: "active",
        totalOrders: orders.length,
        totalSpent: orders.reduce((sum, o) => sum + (o.total || 0), 0),
        lastOrderAt: orders[0]?.createdAt || null,
        createdAt: user.createdAt,
      };

      return NextResponse.json({ success: true, customer: pseudoCustomer, orders });
    }

    // Récupérer les commandes du client par son email
    const orders = await listOrdersByCustomerEmail(customer.email);

    return NextResponse.json({
      success: true,
      customer,
      orders,
    });

  } catch (error) {
    console.error("GET CUSTOMER ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Erreur serveur" },
      { status: 500 }
    );
  }
}

// PUT - Modifier un client
export async function PUT(req, { params }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Champs du schéma Customer uniquement (comme le mode strict de Mongoose) ; id mal
    // formé ou fiche absente -> null.
    let customer = await updateCustomer(id, body);

    // Fallback : l'id est un User._id → créer la fiche Customer
    if (!customer) {
      const user = await findUserSummaryById(id);
      if (!user) {
        return NextResponse.json(
          { success: false, message: "Client non trouvé" },
          { status: 404 }
        );
      }

      // `notes` n'existe pas dans le schéma Customer : Mongoose l'ignorait, il n'est pas repris.
      const nameParts = (user.name || "").trim().split(" ");
      customer = await upsertCustomerForEmail(user.email, {
        firstname: body.firstname || nameParts[0] || "",
        lastname:  body.lastname  || nameParts.slice(1).join(" ") || "",
        phone:     body.phone    ?? user.phone ?? "",
        city:      body.city     ?? user.address?.city ?? "",
        address:   body.address  ?? user.address?.street ?? "",
        status:    body.status   ?? "active",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Client mis à jour",
      customer,
    });

  } catch (error) {
    console.error("PUT CUSTOMER ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Erreur serveur" },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer ou Anonymiser un client
export async function DELETE(req, { params }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ message: "Accès refusé" }, { status: 401 });
    }

    const { id } = await params;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    // Résolution fiche / compte, contrôle admin, comptage des commandes, puis suppression ou
    // anonymisation : tout dans une seule transaction (voir deleteOrAnonymizeCustomer).
    const result = await deleteOrAnonymizeCustomer(id, action);

    if (result.kind === "not_found") {
      return NextResponse.json(
        { success: false, message: "Client non trouvé" },
        { status: 404 }
      );
    }

    if (result.kind === "admin") {
      return NextResponse.json(
        { success: false, message: "Impossible de supprimer un compte administrateur" },
        { status: 400 }
      );
    }

    if (result.kind === "deleted") {
      // Fiche CRM et compte de connexion associé (même email) supprimés ensemble : sans ça,
      // le compte réapparaîtrait dans la liste (jointure User ← Customer de GET /api/customers).
      return NextResponse.json({
        success: true,
        message: result.hadCustomer ? "Client supprimé avec succès" : "Utilisateur supprimé",
        action: "deleted",
      });
    }

    if (result.kind === "anonymized") {
      return NextResponse.json({
        success: true,
        message: `Client anonymisé avec succès.`,
        action: "anonymized",
        ordersCount: result.ordersCount,
      });
    }

    return NextResponse.json({
      success: false,
      message: `Action requise pour ce client avec commandes.`,
      ordersCount: result.ordersCount,
    }, { status: 400 });

  } catch (error) {
    console.error("DELETE CUSTOMER ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Erreur serveur" },
      { status: 500 }
    );
  }
}