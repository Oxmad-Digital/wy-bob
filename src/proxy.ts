import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { connectDB } from '@/app/lib/db'
import SiteSettings from '@/app/models/SiteSettings'

const CACHE_TTL_MS = 5000

let cachedMaintenanceMode = false
let cachedAt = 0

async function isMaintenanceModeActive() {
  const now = Date.now()
  if (now - cachedAt < CACHE_TTL_MS) {
    return cachedMaintenanceMode
  }

  try {
    await connectDB()
    const settings = await SiteSettings.findOne().lean()
    cachedMaintenanceMode = settings?.maintenanceMode ?? false
    cachedAt = now
  } catch {
    // En cas d'erreur DB, on ne bloque pas le site (fail open).
    cachedMaintenanceMode = false
    cachedAt = now
  }

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

  if (!(await isMaintenanceModeActive())) {
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
