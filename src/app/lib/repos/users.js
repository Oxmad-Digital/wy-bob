// Accès aux utilisateurs (users + user_addresses).
// Lot 2a : contact du parrain (création de commande).
// Lot 3d : authentification, vérification d'email, mot de passe oublié, profil, adresses.
// Les mots de passe ne circulent que sous forme de hash bcrypt, et aucune fonction ne renvoie
// de jeton (vérification / réinitialisation) : ils ne servent qu'en paramètre de recherche.
import { query, queryOne, withTransaction, isUuid, isMongoId } from "@/app/lib/neon";

const poolDb = { query: async (text, params) => ({ rows: await query(text, params) }) };

/** Équivalent de User.findById(id).select("email name") — null si absent ou id invalide. */
export async function findUserContactById(id, db = poolDb) {
  if (!isUuid(id)) return null;
  const { rows } = await db.query("SELECT id, email, name FROM users WHERE id = $1", [id]);
  const row = rows[0];
  return row ? { _id: row.id, email: row.email, name: row.name } : null;
}

// -----------------------------------------------------------------------------
// Authentification (auth.ts)
// -----------------------------------------------------------------------------

/**
 * Équivalent de User.findOne({ email }) pour la connexion. Mongoose appliquait au filtre les
 * setters du schéma (`lowercase`, `trim`) : "Client@Example.COM " trouvait "client@example.com".
 * Même normalisation ici (lower(btrim($1))), les emails stockés étant déjà normalisés
 * (CHECK email = lower(btrim(email))). Une valeur qui n'est pas une chaîne ne correspond à rien
 * (Mongo l'aurait interprétée comme un filtre).
 */
export async function findUserForLogin(email) {
  if (typeof email !== "string" || !email) return null;
  const row = await queryOne(
    `SELECT id, name, email, password, role, email_verified, account_locked_until
       FROM users WHERE email = lower(btrim($1))`,
    [email]
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password,
    role: row.role,
    emailVerified: row.email_verified,
    accountLockedUntil: row.account_locked_until,
  };
}

/**
 * Échec de connexion : failedLoginAttempts + 1 et, à partir du 5e échec, verrouillage
 * jusqu'à `lockUntil`. Un seul UPDATE (l'ancien code lisait puis sauvegardait le document).
 */
export async function recordFailedLogin(id, lockUntil) {
  await query(
    `UPDATE users
        SET failed_login_attempts = failed_login_attempts + 1,
            account_locked_until  = CASE WHEN failed_login_attempts + 1 >= 5 THEN $2
                                         ELSE account_locked_until END
      WHERE id = $1`,
    [id, lockUntil]
  );
}

/** Connexion réussie : compteur d'échecs à 0, verrouillage levé, lastLoginAt = `now`. */
export async function recordSuccessfulLogin(id, now) {
  await query(
    `UPDATE users SET failed_login_attempts = 0, account_locked_until = NULL, last_login_at = $2
      WHERE id = $1`,
    [id, now]
  );
}

/** uuid du compte dont l'ancien _id Mongo est `mongoId` (sessions émises avant la bascule). */
export async function findUserIdByMongoId(mongoId) {
  if (!isMongoId(mongoId)) return null;
  const row = await queryOne("SELECT id FROM users WHERE mongo_id = $1", [mongoId.toLowerCase()]);
  return row?.id ?? null;
}

// -----------------------------------------------------------------------------
// Inscription, vérification d'email, mot de passe oublié (api/auth/*)
// -----------------------------------------------------------------------------

/** Email déjà utilisé par un compte (équivalent de l'erreur Mongo 11000) : la route répond 400. */
export class UserEmailTakenError extends Error {}

/**
 * Équivalent de User.findOne({ email }) : contact et état de vérification, sans secret.
 * Même normalisation que Mongoose (lowercase + trim appliqués au filtre), voir findUserForLogin.
 */
export async function findUserByEmail(email) {
  if (typeof email !== "string" || !email) return null;
  const row = await queryOne(
    "SELECT id, name, email, email_verified FROM users WHERE email = lower(btrim($1))",
    [email]
  );
  return row ? { id: row.id, name: row.name, email: row.email, emailVerified: row.email_verified } : null;
}

/** Équivalent de User.exists({ email }). */
export async function userEmailExists(email) {
  return (await findUserByEmail(email)) !== null;
}

/** Équivalent de User.create({...}) à l'inscription (role customer, email non vérifié). */
export async function createUser({ name, email, passwordHash, verificationToken, verificationTokenExpiry }) {
  try {
    const row = await queryOne(
      `INSERT INTO users (name, email, password, role, email_verified, verification_token, verification_token_expiry)
       VALUES ($1, $2, $3, 'customer', false, $4, $5) RETURNING id`,
      [name, email, passwordHash, verificationToken, verificationTokenExpiry]
    );
    return row.id;
  } catch (err) {
    if (err?.code === "23505") throw new UserEmailTakenError("Email déjà utilisé");
    throw err;
  }
}

/** Nouveau jeton de vérification d'email (renvoi du lien). */
export async function setVerificationToken(id, token, expiry) {
  await query(
    "UPDATE users SET verification_token = $2, verification_token_expiry = $3 WHERE id = $1",
    [id, token, expiry]
  );
}

/**
 * Valide l'email du compte dont le jeton est `token` et n'a pas expiré à `now`, et efface le
 * jeton (un lien ne sert qu'une fois). Renvoie { name, email } ou null (lien invalide/expiré).
 */
export async function verifyEmailByToken(token, now) {
  if (typeof token !== "string" || !token) return null;
  return queryOne(
    `UPDATE users
        SET email_verified = true, verification_token = NULL, verification_token_expiry = NULL
      WHERE verification_token = $1 AND verification_token_expiry > $2
      RETURNING name, email`,
    [token, now]
  );
}

/** Nouveau jeton de réinitialisation du mot de passe. */
export async function setResetToken(id, token, expiry) {
  await query("UPDATE users SET reset_token = $2, reset_token_expiry = $3 WHERE id = $1", [id, token, expiry]);
}

/**
 * Réinitialise le mot de passe du compte dont le jeton est `token` et n'a pas expiré à `now` :
 * nouveau hash, jeton effacé, compteur d'échecs à 0, verrouillage levé. Un seul UPDATE : un
 * même lien ne peut pas servir deux fois. Renvoie true si un compte a été mis à jour.
 */
export async function resetPasswordByToken(token, passwordHash, now) {
  if (typeof token !== "string" || !token) return false;
  const row = await queryOne(
    `UPDATE users
        SET password = $2, reset_token = NULL, reset_token_expiry = NULL,
            failed_login_attempts = 0, account_locked_until = NULL
      WHERE reset_token = $1 AND reset_token_expiry > $3
      RETURNING id`,
    [token, passwordHash, now]
  );
  return row !== null;
}

// -----------------------------------------------------------------------------
// Profil (api/user/profile)
// -----------------------------------------------------------------------------

/** Hash du mot de passe actuel (vérification avant changement). */
export async function findPasswordHashById(id) {
  if (!isUuid(id)) return null;
  const row = await queryOne("SELECT password FROM users WHERE id = $1", [id]);
  return row?.password ?? null;
}

/** Équivalent de user.save() du profil : seules les clés présentes (name, phone, passwordHash). */
export async function updateProfile(id, patch) {
  const columns = { name: "name", phone: "phone", passwordHash: "password" };
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(columns)) {
    if (!(key in patch)) continue;
    params.push(patch[key]);
    sets.push(`${column} = $${params.length}`);
  }
  if (sets.length === 0) return;
  params.push(id);
  await query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
}

// -----------------------------------------------------------------------------
// Adresses (users.addresses[] -> user_addresses, ordre = position)
// -----------------------------------------------------------------------------

function toAddress(row) {
  return {
    _id: row.id,
    label: row.label,
    fullName: row.full_name,
    street: row.street,
    zip: row.zip,
    city: row.city,
    country: row.country,
  };
}

async function selectAddresses(db, userId) {
  const { rows } = await db.query(
    "SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY position",
    [userId]
  );
  return rows.map(toAddress);
}

/** Équivalent de user.addresses. */
export async function listUserAddresses(userId) {
  if (!isUuid(userId)) return [];
  return selectAddresses(poolDb, userId);
}

/** Première adresse (addresses[0]) du compte de cet email, ou null. */
export async function findFirstAddressByEmail(email) {
  if (typeof email !== "string" || !email) return null;
  const row = await queryOne(
    `SELECT a.* FROM user_addresses a JOIN users u ON u.id = a.user_id
      WHERE u.email = $1 ORDER BY a.position LIMIT 1`,
    [email]
  );
  return row ? toAddress(row) : null;
}

/**
 * Équivalent de $push: { addresses } : ajout en dernière position. Le compte est verrouillé
 * pendant la transaction pour que deux ajouts simultanés n'obtiennent pas la même position.
 * Renvoie la liste complète.
 */
export async function addUserAddress(userId, { label, fullName, street, zip, city, country }) {
  return withTransaction(async (client) => {
    await client.query("SELECT 1 FROM users WHERE id = $1 FOR UPDATE", [userId]);
    await client.query(
      `INSERT INTO user_addresses (user_id, position, label, full_name, street, zip, city, country)
       SELECT $1, COALESCE(MAX(position) + 1, 0), $2, $3, $4, $5, $6, $7
         FROM user_addresses WHERE user_id = $1`,
      [userId, label ?? "", fullName, street, zip, city, country]
    );
    return selectAddresses(client, userId);
  });
}

/**
 * Équivalent de user.addresses.splice(index, 1) puis save() : l'adresse retirée est choisie
 * par Array.prototype.splice lui-même (index négatif = depuis la fin, index absent ou non
 * numérique = la première, index hors limites = aucune), puis les positions sont renumérotées
 * 0..n-1 (contrainte UNIQUE (user_id, position) différée en fin de transaction).
 * Renvoie la liste restante.
 */
export async function deleteUserAddressAtIndex(userId, index) {
  return withTransaction(async (client) => {
    await client.query("SELECT 1 FROM users WHERE id = $1 FOR UPDATE", [userId]);
    const ids = (
      await client.query("SELECT id FROM user_addresses WHERE user_id = $1 ORDER BY position", [userId])
    ).rows.map((r) => r.id);

    const removed = ids.splice(index, 1);
    if (removed.length > 0) {
      await client.query("DELETE FROM user_addresses WHERE id = $1", [removed[0]]);
      for (let i = 0; i < ids.length; i++) {
        await client.query("UPDATE user_addresses SET position = $2 WHERE id = $1", [ids[i], i]);
      }
    }
    return selectAddresses(client, userId);
  });
}
