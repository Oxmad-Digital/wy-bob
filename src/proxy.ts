import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { connectDB } from '@/app/lib/db'
import SiteSettings from '@/app/models/SiteSettings'

// Next.js déconseille de dépendre du Data Cache (unstable_cache) dans le
// Proxy : il s'exécute hors du pipeline de rendu et ce cache n'y est pas
// garanti disponible. On utilise donc un simple cache mémoire par instance,
// avec un TTL court pour limiter les allers-retours MongoDB.
const CACHE_TTL_MS = 5000
let cachedMaintenanceMode = false
let cacheExpiresAt = 0

async function isMaintenanceModeActive() {
  const now = Date.now()
  if (now < cacheExpiresAt) {
    return cachedMaintenanceMode
  }

  try {
    await connectDB()
    const settings = await SiteSettings.findOne().lean()
    cachedMaintenanceMode = settings?.maintenanceMode ?? false
  } catch {
    // En cas d'erreur DB, on ne bloque pas le site (fail open).
    cachedMaintenanceMode = false
  }

  cacheExpiresAt = now + CACHE_TTL_MS
  return cachedMaintenanceMode
}

export async function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.next()
  }

  const host = request.headers.get('host') ?? ''
  if (host.endsWith('.vercel.app')) {
    return NextResponse.next()
  }

  let maintenanceActive = false
  try {
    maintenanceActive = await isMaintenanceModeActive()
  } catch {
    // En cas d'échec inattendu, on laisse passer plutôt que de bloquer le site.
    return NextResponse.next()
  }

  if (!maintenanceActive) {
    return NextResponse.next()
  }

  return NextResponse.rewrite(new URL('/maintenance', request.url), {
    status: 503,
    headers: { 'Retry-After': '3600' },
  })
}

export const config = {
  matcher: [
    '/((?!maintenance|admin|auth|api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images).*)',
  ],
}
