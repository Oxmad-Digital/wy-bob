'use client'

import { useEffect } from 'react'

export default function GlobalError({
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
    <html lang="fr">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1B1843, #2d2870)',
          padding: '20px',
          fontFamily: 'sans-serif',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '20px',
            padding: '48px',
            textAlign: 'center',
            maxWidth: '440px',
            width: '90%',
          }}>
            <p style={{ fontSize: '40px', margin: 0 }}>⚠️</p>
            <h1 style={{ color: '#fff', fontSize: '22px', margin: '16px 0 8px' }}>
              Une erreur est survenue
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', marginBottom: '28px' }}>
              Désolé pour la gêne occasionnée, notre équipe a été notifiée.
            </p>
            <button
              onClick={() => unstable_retry()}
              style={{
                background: '#F9C464',
                color: '#1B1843',
                padding: '12px 28px',
                borderRadius: '50px',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Réessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
