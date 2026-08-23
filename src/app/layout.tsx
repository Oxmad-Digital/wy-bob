import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { DM_Sans, Quicksand } from 'next/font/google'
import { CartProvider } from '@/components/panier-context'
import SessionWrapper from '@/components/SessionWrapper'
import { LanguageProvider } from '@/contexts/LanguageContext'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import './globals.css'

const CookieConsentBanner = dynamic(() => import('@/components/CookieConsentBanner'))

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const quicksand = Quicksand({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-quicksand',
  display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wybob.shop'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'WYBOB — Bob premium fait main en coton bio, Madagascar',
    template: '%s — WYBOB',
  },
  description: "Bob premium fait main en 100% coton bio, façonné par des artisans à Madagascar. Caractère, confort et savoir-faire artisanal, pensés dans les moindres détails.",
  openGraph: {
    title: 'WYBOB — Bob premium fait main en coton bio, Madagascar',
    description: "Bob premium fait main en 100% coton bio, façonné par des artisans à Madagascar. Caractère, confort et savoir-faire artisanal, pensés dans les moindres détails.",
    url: siteUrl,
    siteName: 'WYBOB',
    locale: 'fr_FR',
    type: 'website',
    images: [{ url: '/images/wybob_bleu.webp', alt: 'Le bob WYBOB' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WYBOB — Bob premium fait main en coton bio, Madagascar',
    description: "Bob premium fait main en 100% coton bio, façonné par des artisans à Madagascar. Caractère, confort et savoir-faire artisanal, pensés dans les moindres détails.",
    images: ['/images/wybob_bleu.webp'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'WYBOB',
  url: siteUrl,
  logo: `${siteUrl}/images/logo.png`,
  sameAs: [
    'https://www.instagram.com/wy_bob',
    'https://www.facebook.com/profile.php?id=61592807902090',
  ],
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'WYBOB',
  url: siteUrl,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${dmSans.variable} ${quicksand.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <GoogleAnalytics />
        <SessionWrapper>
          <LanguageProvider>
            <CartProvider>
              {children}
              <CookieConsentBanner />
            </CartProvider>
          </LanguageProvider>
        </SessionWrapper>
      </body>
    </html>
  )
}