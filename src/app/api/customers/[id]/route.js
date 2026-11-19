import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findCustomerById, updateCustomer, upsertCustomerForEmail } from "@/app/lib/repos/customers";
import { findUserSummaryById } from "@/app/lib/repos/users";
import { listOrdersByCustomerEmail } from "@/app/lib/repos/orders";
// DELETE (suppression / anonymisation RGPD) : encore sur MongoDB, migré au lot 3f.
import { connectDB } from "@/app/lib/db";
import Customer from "@/app/models/Customer";
import Order from "@/app/models/Order";
import User from "@/app/models/User";
import PromoCode from "@/app/models/PromoCode";

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

    await connectDB();

    const { id } = await params; // ✅ Correction ici aussi

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    let customer = await Customer.findById(id);

    // Fallback : l'id est un User._id
    if (!customer) {
      const user = await User.findById(id);
      if (!user) {
        return NextResponse.json(
          { success: false, message: "Client non trouvé" },
          { status: 404 }
        );
      }
      customer = await Customer.findOne({ email: user.email });
      if (!customer) {
        // Utilisateur sans fiche Customer et sans commandes → suppression directe du User
        // et des codes de parrainage qu'il a générés (sinon ils restent orphelins).
        await Promise.all([
          User.findByIdAndDelete(id),
          PromoCode.deleteMany({ referrerId: id, isReferral: true }),
        ]);
        return NextResponse.json({ success: true, message: "Utilisateur supprimé", action: "deleted" });
      }
    }

    const ordersCount = await Order.countDocuments({
      "customer.email": customer.email,
    });

    if (ordersCount === 0) {
      // Supprime la fiche CRM et le compte de connexion associé (même email) :
      // sans ça, le User reste en base et réapparaît dans la liste au prochain
      // chargement (jointure User ← Customer dans GET /api/customers).
      const deletedUser = await User.findOneAndDelete({
        email: customer.email,
        role: { $ne: "admin" },
      });

      await Promise.all([
        Customer.findByIdAndDelete(customer._id),
        deletedUser
          ? PromoCode.deleteMany({ referrerId: deletedUser._id, isReferral: true })
          : Promise.resolve(),
      ]);
      return NextResponse.json({
        success: true,
        message: "Client supprimé avec succès",
        action: "deleted",
      });
    }

    if (action === "anonymize") {
      const anonymizedEmail = `deleted_${id}@anonymized.local`;
      const anonymizedData = {
        firstname: "Client",
        lastname: `Anonyme #${id.toString().slice(-6).toUpperCase()}`,
        email: anonymizedEmail,
        phone: null,
        city: null,
        address: null,
        notes: `[ANONYMISÉ le ${new Date().toLocaleDateString("fr-FR")}] ${customer.notes || ""}`,
        status: "deleted",
        deletedAt: new Date(),
      };

      await Customer.findByIdAndUpdate(id, { $set: anonymizedData });

      await Order.updateMany(
        { "customer.email": customer.email },
        { 
          $set: { 
            "customer.firstname": anonymizedData.firstname,
            "customer.lastname": anonymizedData.lastname,
            "customer.email": anonymizedEmail,
            "customer.phone": "[ANONYMISÉ]",
            "customer.isAnonymized": true,
          } 
        }
      );

      return NextResponse.json({
        success: true,
        message: `Client anonymisé avec succès.`,
        action: "anonymized",
        ordersCount,
      });
    }

    return NextResponse.json({
      success: false,
      message: `Action requise pour ce client avec commandes.`,
      ordersCount,
    }, { status: 400 });

  } catch (error) {
    console.error("DELETE CUSTOMER ERROR:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}