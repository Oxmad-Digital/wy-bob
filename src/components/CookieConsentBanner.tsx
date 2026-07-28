'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'
import { getStoredConsent, saveConsent, onOpenCookieSettings } from '@/lib/cookieConsent'
import './CookieConsentBanner.css'

export default function CookieConsentBanner() {
  const { t } = useLanguage()
  const [visible, setVisible] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const [analyticsChoice, setAnalyticsChoice] = useState(false)

  useEffect(() => {
    if (!getStoredConsent()) setVisible(true)
    return onOpenCookieSettings(() => {
      setAnalyticsChoice(getStoredConsent()?.analytics ?? false)
      setCustomizing(true)
      setVisible(true)
    })
  }, [])

  function acceptAll() {
    saveConsent(true)
    setVisible(false)
    setCustomizing(false)
  }

  function rejectAll() {
    saveConsent(false)
    setVisible(false)
    setCustomizing(false)
  }

  function saveCustom() {
    saveConsent(analyticsChoice)
    setVisible(false)
    setCustomizing(false)
  }

  if (!visible) return null

  return (
    <div className="cookie-banner" role="dialog" aria-modal="true" aria-label={t.cookieConsent.settingsTitle}>
      <div className="cookie-banner-card">
        {!customizing ? (
          <>
            <p className="cookie-banner-text">
              {t.cookieConsent.message}{' '}
              <Link href="/politique-confidentialite">{t.cookieConsent.privacyLink}</Link>
            </p>
            <div className="cookie-banner-actions">
              <button type="button" className="cookie-btn cookie-btn-ghost" onClick={() => setCustomizing(true)}>
                {t.cookieConsent.customize}
              </button>
              <button type="button" className="cookie-btn cookie-btn-ghost" onClick={rejectAll}>
                {t.cookieConsent.rejectAll}
              </button>
              <button type="button" className="cookie-btn cookie-btn-primary" onClick={acceptAll}>
                {t.cookieConsent.acceptAll}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="cookie-banner-title">{t.cookieConsent.settingsTitle}</h2>
            <div className="cookie-option">
              <div>
                <div className="cookie-option-title">{t.cookieConsent.essentialTitle}</div>
                <div className="cookie-option-desc">{t.cookieConsent.essentialDesc}</div>
              </div>
              <input type="checkbox" checked disabled aria-label={t.cookieConsent.essentialTitle} />
            </div>
            <div className="cookie-option">
              <div>
                <div className="cookie-option-title">{t.cookieConsent.analyticsTitle}</div>
                <div className="cookie-option-desc">{t.cookieConsent.analyticsDesc}</div>
              </div>
              <input
                type="checkbox"
                checked={analyticsChoice}
                onChange={(e) => setAnalyticsChoice(e.target.checked)}
                aria-label={t.cookieConsent.analyticsTitle}
              />
            </div>
            <div className="cookie-banner-actions">
              <button type="button" className="cookie-btn cookie-btn-primary" onClick={saveCustom}>
                {t.cookieConsent.save}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
