import { connectDB } from '@/app/lib/db'
import GalleryPhoto from '@/app/models/GalleryPhoto'
import GalerieClient from './GalerieClient'

export const revalidate = 3600

const CDN = 'https://res.cloudinary.com/dnm9txjhm/image/upload/q_auto/f_auto'

export type GalleryImage = { url: string; alt: string | null }

// Les fichiers historiques sont nommés de façon descriptive (ex: wybob_portrait_femme_maillot_noir...)
// — on en tire un alt correct tant qu'aucun texte alternatif n'a été saisi dans l'admin.
function altFromFilename(url: string): string | null {
  const match = url.match(/\/([^/]+)\.[a-zA-Z]+$/)
  if (!match) return null
  const slug = match[1]
    .replace(/^wybob[_-]/i, '')
    .replace(/[_-][a-z0-9]{5,7}$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
  // Un identifiant Cloudinary auto-généré (upload sans nom descriptif) tient en un seul
  // mot sans espace une fois nettoyé — on ne le retient pas comme alt.
  if (!slug.includes(' ')) return null
  return `WYBOB — ${slug}`
}

const FALLBACK_URLS = [
  `${CDN}/v1780486486/wybob_portrait_femme_maillot_noir_chapeau_crochet_blanc_zygujw.jpg`,
  `${CDN}/v1780486485/wybob_portrait_serre_deux_femmes_chapeaux_bikinis_iwlc3v.jpg`,
  `${CDN}/v1780486485/wybob_portrait_femme_souriante_maillot_noir_main_chapeau_eodlwd.jpg`,
  `${CDN}/v1780486484/wybob_deux_femmes_maillots_bikinis_chapeaux_rouges_noirs_kpt1lu.jpg`,
  `${CDN}/v1780486485/wybob_femme_maillot_noir_touche_bois_flotte_v9i1og.jpg`,
  `${CDN}/v1780486484/wybob_deux_femmes_face_sous_hangar_bois_turquoise_exmm9y.jpg`,
  `${CDN}/v1780486485/wybob_trois_femmes_allongees_pont_chapeaux_crochet_rerozt.jpg`,
  `${CDN}/v1780486485/wybob_portrait_deux_femmes_de_bout_sous_hangar_by5fse.jpg`,
  `${CDN}/v1780486484/wybob_portrait_serre_face_deux_femmes_chapeaux_Arrow_oupr9y.jpg`,
]

const FALLBACK_IMAGES: GalleryImage[] = FALLBACK_URLS.map((url) => ({ url, alt: altFromFilename(url) }))

export default async function Galerie() {
  let images: GalleryImage[] = FALLBACK_IMAGES

  try {
    await connectDB()
    const photos = await GalleryPhoto.find({}).sort({ order: 1, createdAt: 1 }).lean() as any[]
    if (photos.length) {
      images = photos.map((p: any) => ({ url: p.url, alt: p.alt || altFromFilename(p.url) }))
    }
  } catch {
    // GalerieClient utilisera les FALLBACK_IMAGES
  }

  return <GalerieClient images={images} />
}
