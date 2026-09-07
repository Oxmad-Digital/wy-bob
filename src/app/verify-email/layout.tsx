import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vérification de l’adresse e-mail',
  robots: {
    index: false,
    follow: false,
  },
}

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
