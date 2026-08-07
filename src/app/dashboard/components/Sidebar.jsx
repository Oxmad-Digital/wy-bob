"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";

function IconHome() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function IconPackage() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  );
}

function IconGift() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 12 20 22 4 22 4 12"/>
      <rect x="2" y="7" width="20" height="5"/>
      <line x1="12" y1="22" x2="12" y2="7"/>
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
    </svg>
  );
}

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, toggleLocale } = useLanguage();
  const s = t.dashboard.sidebar;
  const [moreOpen, setMoreOpen] = useState(false);

  const menuItems = [
    { icon: <IconHome />,    label: s.overview,  short: s.overview,  path: "/dashboard" },
    { icon: <IconPackage />, label: s.orders,    short: s.orders,    path: "/dashboard/orders" },
    { icon: <IconUser />,    label: s.profile,   short: s.profile,   path: "/dashboard/profile" },
    { icon: <IconMapPin />,  label: s.addresses, short: s.addresses, path: "/dashboard/addresses" },
    { icon: <IconGift />,    label: s.referral,  short: s.referral,  path: "/dashboard/referral" },
  ];

  const bottomNavLinks = menuItems.slice(0, 4);
  const moreNavLinks = menuItems.slice(4);
  const isMoreActive = moreNavLinks.some((item) => pathname === item.path);

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="user-avatar">
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <h3>{user.name}</h3>
            <p>{user.email}</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`nav-item ${pathname === item.path ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            onClick={toggleLocale}
            className="logout-btn"
            style={{ marginBottom: 8 }}
            aria-label="Switch language"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span>{locale === 'fr' ? 'EN' : 'FR'}</span>
          </button>
          <button onClick={() => signOut({ redirect: false }).then(() => router.push("/"))} className="logout-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>{s.logout}</span>
          </button>
        </div>
      </aside>

      {/* More sheet mobile */}
      {moreOpen && (
        <>
          <div className="bottom-nav-more-overlay" onClick={() => setMoreOpen(false)} />
          <div className="bottom-nav-more-sheet">
            <div className="bottom-nav-more-header">
              <span>{s.more}</span>
              <button
                type="button"
                className="bottom-nav-more-close"
                onClick={() => setMoreOpen(false)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="bottom-nav-more-grid">
              {moreNavLinks.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMoreOpen(false)}
                  className={`bottom-nav-more-item ${pathname === item.path ? "active" : ""}`}
                >
                  <span className="bottom-nav-icon">{item.icon}</span>
                  <span>{item.short}</span>
                </Link>
              ))}
              <button
                type="button"
                className="bottom-nav-more-item"
                onClick={() => { toggleLocale(); setMoreOpen(false); }}
              >
                <span className="bottom-nav-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                </span>
                <span>{locale === 'fr' ? 'EN' : 'FR'}</span>
              </button>
              <button
                type="button"
                className="bottom-nav-more-item"
                onClick={() => signOut({ redirect: false }).then(() => router.push("/"))}
              >
                <span className="bottom-nav-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                </span>
                <span>{s.exit}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bottom nav mobile */}
      <nav className="bottom-nav">
        {bottomNavLinks.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={`bottom-nav-item ${pathname === item.path ? "active" : ""}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span>{item.short.split(' ')[0]}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`bottom-nav-item ${isMoreActive ? "active" : ""}`}
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
        >
          <span className="bottom-nav-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
            </svg>
          </span>
          <span>{s.more}</span>
        </button>
      </nav>
    </>
  );
}
