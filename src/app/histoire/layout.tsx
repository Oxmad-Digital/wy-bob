import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Notre histoire',
  description: "Découvrez l'histoire de WYBOB : la rencontre avec Pénélope Wybo et le savoir-faire artisanal malgache derrière chaque bob premium en coton bio.",
  alternates: { canonical: '/histoire' },
}

export default function HistoireLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
