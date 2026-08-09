import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { unstable_cache } from 'next/cache'
import { connectDB } from '@/app/lib/db'
import SiteSettings from '@/app/models/SiteSettings'

// Mis en cache via le Data Cache de Next.js (partagé entre instances), plutôt
// qu'un cache mémoire par instance : évite un aller-retour MongoDB devant
// (quasi) chaque page. Invalidé immédiatement via revalidateTag côté
// api/admin/settings quand l'admin bascule le mode maintenance.
const isMaintenanceModeActive = unstable_cache(
  async () => {
    try {
      await connectDB()
      const settings = await SiteSettings.findOne().lean()
      return settings?.maintenanceMode ?? false
    } catch {
      // En cas d'erreur DB, on ne bloque pas le site (fail open).
      return false
    }
  },
  ['maintenance-mode'],
  { tags: ['maintenance-mode'], revalidate: 60 }
)

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
