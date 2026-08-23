import type { MetadataRoute } from 'next'

const routes: Array<{
  path: string
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
  lastModified: string
}> = [
  { path: '', changeFrequency: 'weekly', priority: 1, lastModified: '2026-08-22' },
  { path: '/histoire', changeFrequency: 'monthly', priority: 0.6, lastModified: '2026-08-22' },
  { path: '/concept', changeFrequency: 'monthly', priority: 0.6, lastModified: '2026-08-22' },
  { path: '/galerie', changeFrequency: 'weekly', priority: 0.7, lastModified: '2026-06-18' },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.5, lastModified: '2026-08-09' },
  { path: '/cgv', changeFrequency: 'yearly', priority: 0.3, lastModified: '2026-08-22' },
  { path: '/mentions-legales', changeFrequency: 'yearly', priority: 0.3, lastModified: '2026-08-05' },
  { path: '/politique-confidentialite', changeFrequency: 'yearly', priority: 0.3, lastModified: '2026-08-05' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wybob.shop'

  return routes.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: route.lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
