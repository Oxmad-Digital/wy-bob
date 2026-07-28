import type { MetadataRoute } from 'next'

const routes: Array<{
  path: string
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
}> = [
  { path: '', changeFrequency: 'weekly', priority: 1 },
  { path: '/histoire', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/concept', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/galerie', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/cgv', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/mentions-legales', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/politique-confidentialite', changeFrequency: 'yearly', priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wybob.shop'

  return routes.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
