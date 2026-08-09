/**
 * Injecte une transformation Cloudinary (largeur + qualité/format auto) dans
 * une URL `.../upload/...` pour éviter de télécharger l'image en pleine
 * résolution quand elle n'est affichée qu'en vignette.
 * Retourne l'URL telle quelle si ce n'est pas une URL Cloudinary `/upload/`.
 */
export function cloudinaryThumb(url: string | undefined | null, width: number): string {
  if (!url) return url ?? "";
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const insertAt = idx + marker.length;
  return `${url.slice(0, insertAt)}w_${width},q_auto,f_auto/${url.slice(insertAt)}`;
}
