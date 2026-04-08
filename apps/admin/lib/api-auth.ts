import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/**
 * Verify the request comes from an authenticated Supabase user (cookie-based).
 * Returns the user or a 401 response.
 */
export async function requireAuth() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  }
  return { user, error: null }
}

/**
 * Verify the request comes from an authenticated approved driver (cookie-based).
 * Returns the driver record or a 401/403 response.
 */
export async function requireDriver() {
  const { user, error } = await requireAuth()
  if (error) return { driver: null, error }

  const { data: driver } = await supabaseAdmin
    .from('drivers')
    .select('id, user_id, first_name, last_name, status')
    .eq('user_id', user!.id)
    .eq('status', 'approved')
    .single()

  if (!driver) {
    return { driver: null, error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) }
  }
  return { driver, error: null }
}

/**
 * Verify the request comes from an authenticated admin user (cookie-based).
 * Checks the user has role = 'admin' in the profiles table.
 */
export async function requireAdmin() {
  const { user, error } = await requireAuth()
  if (error) return { user: null, error }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { user: null, error: NextResponse.json({ error: 'Accès refusé — admin uniquement' }, { status: 403 }) }
  }
  return { user, error: null }
}

/**
 * Verify via Bearer token (for mobile-initiated requests).
 * The mobile app sends the Supabase JWT in Authorization: Bearer <token>.
 */
export async function requireBearerAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  }
  const token = authHeader.slice(7)
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return { user: null, error: NextResponse.json({ error: 'Token invalide' }, { status: 401 }) }
  }
  return { user, error: null }
}
