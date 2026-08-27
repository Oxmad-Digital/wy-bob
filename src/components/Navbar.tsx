'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useCart } from '@/components/panier-context'
import { useLanguage } from '@/contexts/LanguageContext'
import './Navbar.css'

export default function Navbar() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const { cartItems } = useCart()
  const { t, locale, toggleLocale } = useLanguage()
  const { data: session } = useSession()
  const totalArticles = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.quantity, 0),
    [cartItems]
  )

  const links = [
    { label: t.nav.home, href: '/' },
    { label: t.nav.histoire, href: '/histoire' },
    { label: t.nav.concept, href: '/concept' },
    { label: t.nav.galerie, href: '/galerie' },
    { label: t.nav.contact, href: '/contact' },
  ]

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!profileRef.current?.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <nav className="navbar">

      {/* Logo */}
      <Link href="/" className="navLogo">
        <Image
          src="/images/logo.png"
          alt="WYBOB Logo"
          width={60}
          height={60}
          style={{ objectFit: 'contain' }}
        />
      </Link>

      {/* Liens desktop */}
      <div className="links">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="link">
            {link.label}
          </Link>
        ))}
      </div>

      {/* Icônes desktop */}
      <div className="icons">

        {/* Sélecteur de langue */}
        <button className="langBtn" onClick={toggleLocale} aria-label="Switch language">
          {locale.toUpperCase()}
        </button>

        {/* Panier */}
        <Link href="/panier" className="iconBtn panierIcon">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#1B1843' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          {totalArticles > 0 && (
            <span className="panierBadge">{totalArticles}</span>
          )}
        </Link>

        {/* Profil avec menu déroulant */}
        <div className="profileWrapper" ref={profileRef}>
          <button className="iconBtn" onClick={() => setProfileOpen(!profileOpen)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#1B1843' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>

          {profileOpen && (
            <div className="profileMenu">
              {session ? (
                <>
                  <Link href="/dashboard" onClick={() => setProfileOpen(false)}>
                    {t.nav.dashboard}
                  </Link>
                  <button onClick={() => { setProfileOpen(false); signOut({ redirect: false }).then(() => router.push('/')) }}>
                    {t.nav.logout}
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth/login" onClick={() => setProfileOpen(false)}>
                    {t.nav.login}
                  </Link>
                  <Link href="/auth/register" onClick={() => setProfileOpen(false)}>
                    {t.nav.register}
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Bouton hamburger */}
      <button
        className="hamburgerBtn"
        onClick={() => setMenuOpen(true)}
        aria-label="Ouvrir le menu"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#1B1843" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Menu mobile plein écran : rendu via portail dans <body> pour échapper au
          conteneur "glass" (.container, backdrop-filter), qui sur iOS Safari
          devient une containing block pour les descendants position:fixed et
          y emprisonne le menu (marge visible tout autour). */}
      {menuOpen && mounted && createPortal(
        <div className="mobileMenu">

          {/* Header : logo + bouton fermer */}
          <div className="mobileMenuHeader">
            <Link href="/" className="mobileMenuLogo" onClick={() => setMenuOpen(false)}>
              <Image
                src="/images/logo.png"
                alt="WYBOB Logo"
                width={56}
                height={56}
                style={{ objectFit: 'contain' }}
              />
            </Link>
            <button className="mobileCloseBtn" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Liens de navigation */}
          <nav className="mobileNavLinks">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="mobileLink"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Séparateur */}
          <div className="mobileSeparator" />

          {/* Actions secondaires */}
          <div className="mobileActions">
            <Link href="/panier" className="mobileActionLink" onClick={() => setMenuOpen(false)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              {t.nav.panier}{totalArticles > 0 && ` (${totalArticles})`}
            </Link>
            {session ? (
              <>
                <Link href="/dashboard" className="mobileActionLink" onClick={() => setMenuOpen(false)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  {t.nav.dashboard}
                </Link>
                <button className="mobileActionLink" onClick={() => { setMenuOpen(false); signOut({ redirect: false }).then(() => router.push('/')) }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  {t.nav.logout}
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="mobileActionLink" onClick={() => setMenuOpen(false)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  {t.nav.login}
                </Link>
                <Link href="/auth/register" className="mobileActionLink" onClick={() => setMenuOpen(false)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                  {t.nav.register}
                </Link>
              </>
            )}
            <button className="mobileLangBtn" onClick={() => { toggleLocale(); setMenuOpen(false) }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
              {locale === 'fr' ? 'Français' : 'English'}
            </button>
          </div>

        </div>,
        document.body
      )}

    </nav>
  )
}
