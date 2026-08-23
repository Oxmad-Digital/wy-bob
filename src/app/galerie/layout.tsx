import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Notre Galerie',
  description: 'Découvrez la galerie photos WYBOB : chapeaux et bérets artisanaux capturés sous leur meilleur jour.',
  alternates: { canonical: '/galerie' },
}

export default function GalerieLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
