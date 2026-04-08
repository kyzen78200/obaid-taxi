import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = request.nextUrl

  // ── Page de connexion chauffeur ────────────────────────────────────────────
  if (pathname === '/driver-login') {
    if (session) {
      const role = session.user.user_metadata?.role
      if (role === 'driver') return NextResponse.redirect(new URL('/driver', request.url))
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // ── Page de connexion admin ─────────────────────────────────────────────────
  if (pathname === '/login') {
    if (session) {
      const role = session.user.user_metadata?.role
      const dest = role === 'driver' ? '/driver' : '/dashboard'
      return NextResponse.redirect(new URL(dest, request.url))
    }
    return supabaseResponse
  }

  // ── Racine ──────────────────────────────────────────────────────────────────
  if (pathname === '/') {
    if (!session) return NextResponse.redirect(new URL('/login', request.url))
    const role = session.user.user_metadata?.role
    const dest = role === 'driver' ? '/driver' : '/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // ── Non authentifié ─────────────────────────────────────────────────────────
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const role = session.user.user_metadata?.role

  // Routes chauffeur : /driver (exact) ou /driver/...
  const isDriverRoute = pathname === '/driver' || pathname.startsWith('/driver/')

  // ── Chauffeur : accès limité aux routes /driver/* ─────────────────────────
  if (role === 'driver') {
    if (!isDriverRoute) {
      return NextResponse.redirect(new URL('/driver', request.url))
    }
    return supabaseResponse
  }

  // ── Admin : pas d'accès aux routes /driver/* ─────────────────────────────
  if (isDriverRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
