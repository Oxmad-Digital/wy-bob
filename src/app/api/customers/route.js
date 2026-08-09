import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/db";
import Customer from "@/app/models/Customer";
import Order from "@/app/models/Order";
import User from "@/app/models/User";

const ALLOWED_SORT_FIELDS = new Set([
  "createdAt", "updatedAt", "totalOrders", "totalSpent",
  "lastOrderAt", "firstname", "lastname", "email",
]);

/* =========================
   GET - Liste des clients
========================= */
export async function GET(req) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const search    = searchParams.get("search") || "";
    const status    = searchParams.get("status") || "";
    const sortField = ALLOWED_SORT_FIELDS.has(searchParams.get("sort"))
      ? searchParams.get("sort")
      : "createdAt";
    const sortDir = searchParams.get("order") === "asc" ? 1 : -1;
    const page    = Math.max(1, parseInt(searchParams.get("page"))  || 1);
    const limit   = Math.min(100, parseInt(searchParams.get("limit")) || 20);

    // Pipeline : join User ← Customer par email, merge des champs, filtre, tri, pagination
    const pipeline = [
      // Join avec la collection customers (emails déjà en minuscules dans les deux schémas)
      {
        $lookup: {
          from: "customers",
          localField: "email",
          foreignField: "email",
          as: "_customer",
        },
      },
      {
        $addFields: {
          _c: { $arrayElemAt: ["$_customer", 0] },
          _nameParts: {
            $split: [{ $trim: { input: { $ifNull: ["$name", ""] } } }, " "],
          },
        },
      },
      {
        $project: {
          _id: { $ifNull: ["$_c._id", "$_id"] },
          firstname: {
            $ifNull: ["$_c.firstname", { $arrayElemAt: ["$_nameParts", 0] }],
          },
          lastname: {
            $ifNull: [
              "$_c.lastname",
              {
                $trim: {
                  input: {
                    $reduce: {
                      input: { $slice: ["$_nameParts", 1, 100] },
                      initialValue: "",
                      in: { $concat: ["$$value", " ", "$$this"] },
                    },
                  },
                },
              },
            ],
          },
          email: 1,
          phone:       { $ifNull: ["$_c.phone",       { $ifNull: ["$phone", ""] }] },
          city:        { $ifNull: ["$_c.city",        { $ifNull: ["$address.city", ""] }] },
          address:     { $ifNull: ["$_c.address",     { $ifNull: ["$address.street", ""] }] },
          totalOrders: { $ifNull: ["$_c.totalOrders", 0] },
          totalSpent:  { $ifNull: ["$_c.totalSpent",  0] },
          lastOrderAt: { $ifNull: ["$_c.lastOrderAt", null] },
          status:      { $ifNull: ["$_c.status",      "active"] },
          role:        { $ifNull: ["$role",            "customer"] },
          createdAt:   { $ifNull: ["$_c.createdAt",   "$createdAt"] },
          updatedAt:   { $ifNull: ["$_c.updatedAt",   "$createdAt"] },
        },
      },
    ];

    // Filtre recherche (regex échappée)
    if (search) {
      const re = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      pipeline.push({
        $match: {
          $or: [
            { firstname: { $regex: re, $options: "i" } },
            { lastname:  { $regex: re, $options: "i" } },
            { email:     { $regex: re, $options: "i" } },
            { phone:     { $regex: re, $options: "i" } },
          ],
        },
      });
    }
    if (status) pipeline.push({ $match: { status } });

    // Tri + pagination atomique via $facet
    pipeline.push({ $sort: { [sortField]: sortDir } });
    pipeline.push({
      $facet: {
        data:  [{ $skip: (page - 1) * limit }, { $limit: limit }],
        total: [{ $count: "count" }],
      },
    });

    const [result]   = await User.aggregate(pipeline);
    const customers  = result?.data || [];
    const total      = result?.total?.[0]?.count || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      success: true,
      customers,
      pagination: { total, page, limit, totalPages },
    });
  } catch (error) {
    console.error("GET CUSTOMERS ERROR:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

/* =========================
   POST - Create / Sync
========================= */
export async function POST(req) {
  try {
    await connectDB();
    const body = await req.json();

    if (body.action === "sync") {
      return await syncCustomersFromOrders();
    }

    const { firstname, lastname, email, phone, city, address } = body;

    const exists = await Customer.findOne({ email: email.toLowerCase() });
    if (exists) {
      return NextResponse.json(
        { success: false, message: "Ce client existe déjà" },
        { status: 400 }
      );
    }

    const customer = await Customer.create({
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
    console.error("POST CUSTOMER ERROR:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

/* =========================
   SYNC CLIENTS (PRO & SAFE)
========================= */
async function syncCustomersFromOrders() {
  try {
    await connectDB();

    const customersMap = {};

    // 1. Agrège les commandes par email
    const orders = await Order.find({
      "customer.email": { $exists: true },
    }).sort({ createdAt: -1 });

    for (const order of orders) {
      const email = order.customer.email.toLowerCase();

      if (!customersMap[email]) {
        customersMap[email] = {
          firstname: order.customer.firstname || "",
          lastname: order.customer.lastname || "",
          email,
          phone: order.customer.phone || "",
          city: order.customer.city || "",
          address: order.customer.address || "",
          totalOrders: 0,
          totalSpent: 0,
          lastOrderAt: order.createdAt,
        };
      }

      customersMap[email].totalOrders += 1;
      customersMap[email].totalSpent += order.total || 0;
    }

    // 2. Importe les utilisateurs inscrits sans commande
    const registeredUsers = await User.find(
      { role: { $ne: "admin" } },
      { name: 1, email: 1, phone: 1, address: 1, createdAt: 1 }
    );

    for (const user of registeredUsers) {
      const email = user.email.toLowerCase();
      if (customersMap[email]) continue; // déjà dans les commandes

      const nameParts = (user.name || "").trim().split(" ");
      const firstname = nameParts[0] || "";
      const lastname = nameParts.slice(1).join(" ") || "";

      customersMap[email] = {
        firstname,
        lastname,
        email,
        phone: user.phone || "",
        city: user.address?.city || "",
        address: user.address?.street || "",
        totalOrders: 0,
        totalSpent: 0,
        lastOrderAt: null,
      };
    }

    let created = 0;
    let updated = 0;

    const emails = Object.keys(customersMap);
    if (emails.length > 0) {
      const result = await Customer.bulkWrite(
        emails.map((email) => ({
          updateOne: {
            filter: { email },
            update: { $set: customersMap[email] },
            upsert: true,
          },
        }))
      );
      created = result.upsertedCount ?? 0;
      updated = result.matchedCount ?? 0;
    }

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
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}