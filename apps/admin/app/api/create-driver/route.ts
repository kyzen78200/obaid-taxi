import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  try {
    // Only admins can create driver accounts directly
    const { error: authError } = await requireAdmin()
    if (authError) return authError

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    )

    const body = await req.json()
    const { email, password, first_name, last_name, phone } = body

    if (!email || !password || !first_name || !last_name) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    // Create auth user
    const { data: authData, error: authError2 } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password.trim(),
      email_confirm: true,
      user_metadata: {
        role: 'driver',
        full_name: `${first_name.trim()} ${last_name.trim()}`,
      },
    })

    if (authError2) {
      return NextResponse.json({ error: authError2.message }, { status: 400 })
    }

    // Create driver record
    const { error: driverError } = await supabaseAdmin.from('drivers').insert({
      user_id: authData.user.id,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone: phone?.trim() || null,
      status: 'approved',
    })

    if (driverError) {
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: driverError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
