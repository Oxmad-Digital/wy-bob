import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Notre concept',
  description: 'Produire moins, mais produire mieux : découvrez le concept WYBOB, une gamme resserrée de bobs artisanaux en coton bio fabriqués à Madagascar.',
  alternates: { canonical: '/concept' },
}

export default function ConceptLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
