// Accès aux fiches clients CRM (table customers). Lot 2a : mise à jour après commande.
// Complété au lot 3.

/**
 * Met à jour (ou crée) la fiche client après une commande, dans la transaction `client`.
 * Même règles que l'ancien code de /api/order :
 *  - fiche existante : totalOrders + 1, totalSpent + total, lastOrderAt = maintenant, et
 *    phone / city / address ne sont renseignés que s'ils étaient vides ;
 *  - sinon : création avec status "active".
 * Un seul INSERT … ON CONFLICT : deux premières commandes simultanées du même email ne
 * peuvent pas créer de doublon ni faire échouer la commande.
 */
export async function recordCustomerOrder(client, { firstname, lastname, email, phone, city, address, total }) {
  await client.query(
    `INSERT INTO customers
       (firstname, lastname, email, phone, city, address, total_orders, total_spent, last_order_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, 1, $7, now(), 'active')
     ON CONFLICT (email) DO UPDATE SET
       total_orders  = customers.total_orders + 1,
       total_spent   = customers.total_spent + EXCLUDED.total_spent,
       last_order_at = now(),
       phone   = CASE WHEN customers.phone   = '' AND EXCLUDED.phone   <> '' THEN EXCLUDED.phone   ELSE customers.phone   END,
       city    = CASE WHEN customers.city    = '' AND EXCLUDED.city    <> '' THEN EXCLUDED.city    ELSE customers.city    END,
       address = CASE WHEN customers.address = '' AND EXCLUDED.address <> '' THEN EXCLUDED.address ELSE customers.address END`,
    [firstname, lastname ?? "", email, phone || "", city || "", address || "", total]
  );
}
