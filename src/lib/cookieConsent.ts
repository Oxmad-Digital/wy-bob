const STORAGE_KEY = 'wybob-cookie-consent'
const CONSENT_EVENT = 'wybob-cookie-consent-change'
const OPEN_SETTINGS_EVENT = 'wybob-cookie-consent-open'

export type CookieConsent = {
  essential: true
  analytics: boolean
  decidedAt: string
}

export function getStoredConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CookieConsent
  } catch {
    return null
  }
}

export function saveConsent(analytics: boolean) {
  const consent: CookieConsent = {
    essential: true,
    analytics,
    decidedAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent))
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: consent }))
  return consent
}

export function onConsentChange(callback: (consent: CookieConsent) => void) {
  const handler = (e: Event) => callback((e as CustomEvent<CookieConsent>).detail)
  window.addEventListener(CONSENT_EVENT, handler)
  return () => window.removeEventListener(CONSENT_EVENT, handler)
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))
}

export function onOpenCookieSettings(callback: () => void) {
  window.addEventListener(OPEN_SETTINGS_EVENT, callback)
  return () => window.removeEventListener(OPEN_SETTINGS_EVENT, callback)
}
