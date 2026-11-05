// Accès aux utilisateurs (table users). Lot 2a : uniquement ce dont la création de commande
// a besoin (nom et email du parrain). Complété au lot 3.
import { query, isUuid } from "@/app/lib/neon";

const poolDb = { query: async (text, params) => ({ rows: await query(text, params) }) };

/** Équivalent de User.findById(id).select("email name") — null si absent ou id invalide. */
export async function findUserContactById(id, db = poolDb) {
  if (!isUuid(id)) return null;
  const { rows } = await db.query("SELECT id, email, name FROM users WHERE id = $1", [id]);
  const row = rows[0];
  return row ? { _id: row.id, email: row.email, name: row.name } : null;
}
