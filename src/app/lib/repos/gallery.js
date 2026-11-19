// Accès à la galerie photo (table gallery_photos). Lot 3a.
// Formes identiques aux documents Mongoose .lean() : `_id`, `url`, `publicId`, `order`, `alt`.
import { query, queryOne, isUuid, isMongoId } from "@/app/lib/neon";

function toPhoto(row) {
  if (!row) return null;
  return {
    _id: row.id,
    url: row.url,
    publicId: row.public_id,
    order: row.sort_order,
    alt: row.alt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Colonne à utiliser pour retrouver une photo : uuid Neon, ou ancien ObjectId Mongo (onglet
 * admin chargé avant la bascule). null si l'identifiant est mal formé — il ne doit jamais
 * atteindre une colonne uuid.
 */
function idLookup(id) {
  if (isUuid(id)) return { column: "id", value: id };
  if (isMongoId(id)) return { column: "mongo_id", value: id.toLowerCase() };
  return null;
}

/** Équivalent de GalleryPhoto.find({}).sort({ order: 1, createdAt: 1 }). */
export async function listGalleryPhotos() {
  const rows = await query("SELECT * FROM gallery_photos ORDER BY sort_order, created_at");
  return rows.map(toPhoto);
}

/**
 * Ajoute une photo en dernière position (max + 1). L'ancien code utilisait le nombre de
 * photos, qui pouvait redonner un ordre déjà pris après une suppression.
 */
export async function createGalleryPhoto({ url, publicId = null }) {
  const row = await queryOne(
    `INSERT INTO gallery_photos (url, public_id, sort_order)
     SELECT $1, $2, COALESCE(MAX(sort_order) + 1, 0) FROM gallery_photos
     RETURNING *`,
    [url, publicId]
  );
  return toPhoto(row);
}

/**
 * Applique l'ordre reçu de l'admin : la photo à l'index i prend sort_order = i. Une seule
 * requête UPDATE, donc atomique. Les identifiants mal formés ou inconnus sont ignorés sans
 * décaler les positions des autres.
 */
export async function reorderGalleryPhotos(orderedIds) {
  const refs = orderedIds.map((id) => {
    const lookup = idLookup(id);
    return lookup ? lookup.value : "";
  });
  const rows = await query(
    `UPDATE gallery_photos g
        SET sort_order = v.pos - 1
       FROM unnest($1::text[]) WITH ORDINALITY AS v(ref, pos)
      WHERE v.ref <> '' AND (g.id::text = v.ref OR g.mongo_id = v.ref)
     RETURNING g.id`,
    [refs]
  );
  return rows.length;
}

/** Équivalent de findByIdAndUpdate(id, { alt }) — null si introuvable. */
export async function updateGalleryPhotoAlt(id, alt) {
  const lookup = idLookup(id);
  if (!lookup) return null;
  const row = await queryOne(
    `UPDATE gallery_photos SET alt = $2 WHERE ${lookup.column} = $1 RETURNING *`,
    [lookup.value, alt || null]
  );
  return toPhoto(row);
}

/** Équivalent de findByIdAndDelete(id) — false si introuvable. */
export async function deleteGalleryPhoto(id) {
  const lookup = idLookup(id);
  if (!lookup) return false;
  const rows = await query(
    `DELETE FROM gallery_photos WHERE ${lookup.column} = $1 RETURNING id`,
    [lookup.value]
  );
  return rows.length > 0;
}
