// Agrégats du tableau de bord admin (api/admin/stats) : customers, products, orders, order_items.
// Mêmes définitions et filtres que les anciennes requêtes Mongo : les commandes `pending` et
// `cancelled` restent comptées partout (CA, panier moyen, tops) ; seuls pendingOrders /
// cancelledOrders les isolent. Les bornes de dates sont calculées par la route (heure du
// serveur) et passées telles quelles.
// 9 requêtes en parallèle (le pool Neon est limité à 5 connexions) au lieu de 21 côté Mongo.
import { query, queryOne } from "@/app/lib/neon";

/** Retire les clés à null/undefined (champ absent dans le document Mongo). */
function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));
}

/**
 * @param {{ periodStart: Date, prevPeriodStart: Date, today: Date, thirtyDaysAgo: Date }} bounds
 */
export async function getAdminStatsAggregates({ periodStart, prevPeriodStart, today, thirtyDaysAgo }) {
  const [
    customers,
    products,
    orders,
    salesEvolution,
    topProducts,
    ordersByStatus,
    payments,
    topCustomers,
    recentOrders,
  ] = await Promise.all([
    queryOne(
      `SELECT COUNT(*)                                                AS customers_count,
              COUNT(*) FILTER (WHERE created_at >= $1)                AS new_customers,
              COUNT(*) FILTER (WHERE total_orders > 1)                AS returning_customers,
              COUNT(*) FILTER (WHERE last_order_at IS NOT NULL
                                 AND last_order_at < $2
                                 AND status = 'active')               AS dormant_customers
         FROM customers`,
      [periodStart, thirtyDaysAgo]
    ),

    queryOne(
      `SELECT COUNT(*) FILTER (WHERE stock > 0 AND stock <= 3) AS low_stock,
              COUNT(*) FILTER (WHERE stock = 0)                AS out_of_stock,
              COALESCE(SUM(stock * price), 0)                  AS stock_value
         FROM products`
    ),

    queryOne(
      `SELECT COUNT(*)                                                             AS orders_count,
              COUNT(*) FILTER (WHERE created_at >= $1)                             AS period_orders,
              COUNT(*) FILTER (WHERE created_at >= $3)                             AS today_orders,
              COUNT(*) FILTER (WHERE status = 'cancelled')                         AS cancelled_orders,
              COUNT(*) FILTER (WHERE status = 'pending')                           AS pending_orders,
              COALESCE(SUM(total), 0)                                              AS total_revenue,
              COALESCE(SUM(total) FILTER (WHERE created_at >= $1), 0)              AS period_revenue,
              COALESCE(SUM(total) FILTER (WHERE created_at >= $2
                                            AND created_at <  $1), 0)              AS prev_period_revenue
         FROM orders`,
      [periodStart, prevPeriodStart, today]
    ),

    // Mongo $year/$month/$dayOfMonth regroupe au jour UTC.
    query(
      `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
              COALESCE(SUM(total), 0)                              AS revenue,
              COUNT(*)                                             AS orders
         FROM orders
        WHERE created_at >= $1
        GROUP BY 1
        ORDER BY 1`,
      [periodStart]
    ),

    // Comme Mongo : $group par produit référencé puis $limit 5 AVANT le $lookup — un produit
    // supprimé (product_id NULL, référence brute dans product_mongo_id) occupe une place puis
    // disparaît à la jointure : la liste peut alors compter moins de 5 lignes.
    query(
      `WITH top AS (
         SELECT COALESCE(product_id::text, product_mongo_id) AS ref,
                COALESCE(SUM(quantity), 0)                   AS total_quantity
           FROM order_items
          GROUP BY 1
          ORDER BY total_quantity DESC, ref
          LIMIT 5
       )
       SELECT p.id AS _id, p.name, top.total_quantity AS quantity
         FROM top
         JOIN products p ON p.id::text = top.ref
        ORDER BY top.total_quantity DESC, top.ref`
    ),

    query(
      `SELECT status, COUNT(*) AS count
         FROM orders
        GROUP BY status
        ORDER BY count DESC, status`
    ),

    query(
      `SELECT COALESCE(payment, 'cash') AS payment, COUNT(*) AS count
         FROM orders
        GROUP BY 1
        ORDER BY count DESC, payment`
    ),

    // $first (ordre naturel Mongo ≈ ordre d'insertion) -> prénom/nom de la plus ancienne commande.
    query(
      `SELECT (array_agg(customer_firstname ORDER BY created_at, id))[1] AS firstname,
              (array_agg(customer_lastname  ORDER BY created_at, id))[1] AS lastname,
              COALESCE(SUM(total), 0)                                    AS total_spent,
              COUNT(*)                                                   AS total_orders
         FROM orders
        GROUP BY customer_email
        ORDER BY total_spent DESC, customer_email
        LIMIT 5`
    ),

    query(
      `SELECT id, customer_firstname, customer_lastname, total, status, created_at
         FROM orders
        ORDER BY created_at DESC, id DESC
        LIMIT 5`
    ),
  ]);

  return {
    customersCount:     customers.customers_count,
    newCustomers:       customers.new_customers,
    returningCustomers: customers.returning_customers,
    dormantCustomers:   customers.dormant_customers,

    lowStockProducts:   products.low_stock,
    outOfStockProducts: products.out_of_stock,
    stockValue:         products.stock_value,

    ordersCount:        orders.orders_count,
    periodOrdersCount:  orders.period_orders,
    todayOrders:        orders.today_orders,
    cancelledOrders:    orders.cancelled_orders,
    pendingOrders:      orders.pending_orders,
    totalRevenue:       orders.total_revenue,
    periodRevenue:      orders.period_revenue,
    prevPeriodRevenue:  orders.prev_period_revenue,

    /** [{ day: "YYYY-MM-DD", revenue, orders }] */
    salesEvolution,
    /** [{ _id, name, quantity }] — même forme que l'ancien $project (qui gardait _id) */
    topProducts,
    /** [{ status, count }] trié par count décroissant */
    ordersByStatus,
    /** [{ payment, count }] trié par count décroissant */
    payments,
    topCustomers: topCustomers.map((c) => ({
      firstname:   c.firstname,
      lastname:    c.lastname,
      totalSpent:  c.total_spent,
      totalOrders: c.total_orders,
    })),
    // Même forme que .select("customer.firstname customer.lastname total status createdAt").lean()
    recentOrders: recentOrders.map((o) => ({
      _id: o.id,
      customer: compact({ firstname: o.customer_firstname, lastname: o.customer_lastname }),
      ...(o.total !== null ? { total: o.total } : {}),
      status: o.status,
      createdAt: o.created_at,
    })),
  };
}
