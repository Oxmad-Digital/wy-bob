import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Une question sur votre commande ou sur nos bobs artisanaux en coton bio ? Contactez l’équipe WYBOB.',
  alternates: { canonical: '/contact' },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
