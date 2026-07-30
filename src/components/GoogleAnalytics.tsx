'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { getStoredConsent, onConsentChange } from '@/lib/cookieConsent'

const GA_MEASUREMENT_ID = 'G-6K0M03PL1C'

export default function GoogleAnalytics() {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false)

  useEffect(() => {
    setAnalyticsAllowed(getStoredConsent()?.analytics ?? false)
    return onConsentChange((consent) => setAnalyticsAllowed(consent.analytics))
  }, [])

  if (!GA_MEASUREMENT_ID || !analyticsAllowed) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  )
}
