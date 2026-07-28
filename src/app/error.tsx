'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1B1843, #2d2870)',
      padding: '20px',
    }}>
      <div style={{
        backdropFilter: 'blur(16px)',
        background: 'rgba(255,255,255,0.12)',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '20px',
        padding: '48px',
        textAlign: 'center',
        maxWidth: '440px',
        width: '90%',
      }}>
        <p style={{ fontSize: '40px', margin: 0 }}>⚠️</p>
        <h1 style={{ color: '#fff', fontFamily: 'Quicksand, sans-serif', fontSize: '22px', margin: '16px 0 8px' }}>
          Une erreur est survenue
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontFamily: 'DM Sans, sans-serif', marginBottom: '28px' }}>
          Désolé pour la gêne occasionnée, notre équipe a été notifiée. Vous pouvez réessayer ou revenir à l&apos;accueil.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => unstable_retry()}
            style={{
              background: '#F9C464',
              color: '#1B1843',
              padding: '12px 28px',
              borderRadius: '50px',
              border: 'none',
              fontWeight: 700,
              fontFamily: 'DM Sans, sans-serif',
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
          <Link href="/" style={{
            display: 'inline-block',
            background: 'transparent',
            color: '#fff',
            padding: '12px 28px',
            borderRadius: '50px',
            border: '1px solid rgba(255,255,255,0.4)',
            textDecoration: 'none',
            fontWeight: 700,
            fontFamily: 'DM Sans, sans-serif',
          }}>
            Accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
