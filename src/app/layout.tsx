import type { Metadata } from 'next'
import { DM_Sans, Quicksand } from 'next/font/google'
import { CartProvider } from '@/components/panier-context'
import SessionWrapper from '@/components/SessionWrapper'
import { LanguageProvider } from '@/contexts/LanguageContext'
import CookieConsentBanner from '@/components/CookieConsentBanner'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import './globals.css'

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
  keywords: ['WYBOB', 'bob', 'chapeau', 'bob premium', 'bob artisanal', 'accessoire mode'],
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${dmSans.variable} ${quicksand.variable}`}>
      <body>
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