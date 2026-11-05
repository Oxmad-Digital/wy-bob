// Accès PostgreSQL (Neon) via @neondatabase/serverless : connexion WebSocket sur le port 443
// (le TCP 5432 n'est pas joignable depuis tous les réseaux), en local comme en production.
// Le Pool expose l'API de `pg` (query / connect / release) et supporte les vraies transactions.
import { Pool, neonConfig, types } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// numeric -> number et bigint -> number : sans ça, pg renvoie des chaînes ("85.5", "12")
// et les réponses JSON des routes changeraient de type par rapport à Mongo.
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

const g = globalThis;

function getPool() {
  if (!g.__neonPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL manquant dans l'environnement");
    const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 });
    // Une connexion inactive coupée côté serveur ne doit pas faire planter le process.
    pool.on("error", (err) => console.error("[neon] erreur de connexion inactive :", err?.message));
    g.__neonPool = pool;
  }
  return g.__neonPool;
}

/** Exécute une requête paramétrée et renvoie toutes les lignes. */
export async function query(text, params = []) {
  const res = await getPool().query(text, params);
  return res.rows;
}

/** Exécute une requête paramétrée et renvoie la première ligne (ou null). */
export async function queryOne(text, params = []) {
  const res = await getPool().query(text, params);
  return res.rows[0] ?? null;
}

/**
 * Exécute `fn(client)` dans une transaction : COMMIT si fn réussit, ROLLBACK sinon.
 * Toutes les requêtes de la transaction doivent passer par `client` (même connexion).
 * @template T
 * @param {(client: any) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONGO_ID_RE = /^[0-9a-f]{24}$/i;

/** Remplace mongoose.Types.ObjectId.isValid : un id mal formé ne doit jamais atteindre une colonne uuid. */
export const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);

/** Ancien identifiant Mongo (24 hex) — n'est accepté qu'aux endroits explicitement prévus. */
export const isMongoId = (v) => typeof v === "string" && MONGO_ID_RE.test(v);
