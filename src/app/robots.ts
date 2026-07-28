import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wybob.shop'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/dashboard', '/api', '/checkout', '/panier', '/auth', '/paiement-complementaire'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
