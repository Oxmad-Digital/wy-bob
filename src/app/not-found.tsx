import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import './page.css'

export const metadata = {
  title: 'Page introuvable — WYBOB',
  description: "Cette page n'existe pas ou plus.",
}

export default function NotFound() {
  return (
    <div className="container">
      <Navbar />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '48px 20px' }}>
        <div style={{
          backdropFilter: 'blur(16px)',
          background: 'rgba(255,255,255,0.2)',
          border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: '20px',
          padding: '48px',
          textAlign: 'center',
          maxWidth: '440px',
          width: '90%',
        }}>
          <p style={{ fontSize: '40px', margin: 0 }}>🎩</p>
          <h1 style={{ color: '#1B1843', fontFamily: 'Quicksand', fontSize: '28px', margin: '12px 0' }}>404</h1>
          <p style={{ color: '#1B1843', fontFamily: 'Quicksand', fontWeight: 700, fontSize: '18px', margin: '0 0 12px' }}>
            Page introuvable
          </p>
          <p style={{ color: '#444', fontFamily: 'DM Sans', marginBottom: '28px' }}>
            Cette page n&apos;existe pas ou a été déplacée.
          </p>
          <Link href="/" style={{
            display: 'inline-block',
            background: '#F9C464',
            color: '#1B1843',
            padding: '12px 32px',
            borderRadius: '50px',
            textDecoration: 'none',
            fontWeight: 700,
            fontFamily: 'DM Sans',
          }}>
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  )
}
