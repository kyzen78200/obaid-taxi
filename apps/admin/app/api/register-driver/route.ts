import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { driverWelcomeHtml } from '@/lib/resend'
import { sendEmail } from '@/lib/notify'
import { createAdminNotification } from '@/lib/notify'
import { rateLimit, getIp } from '@/lib/rate-limit'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://drivers.otaxi.fr',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    // 5 tentatives max par IP par heure
    const ip = getIp(req)
    const { ok, retryAfterMs } = rateLimit(ip, 5, 60 * 60 * 1000)
    if (!ok) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
        {
          status: 429,
          headers: { ...CORS_HEADERS, 'Retry-After': String(Math.ceil((retryAfterMs ?? 0) / 1000)) },
        },
      )
    }
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'Configuration serveur manquante.' }, { status: 500, headers: CORS_HEADERS })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    )

    const body = await req.json()
    const { email, password, first_name, last_name, phone } = body

    if (!email || !password || !first_name || !last_name || !phone) {
      return NextResponse.json({ error: 'Tous les champs sont requis.' }, { status: 400, headers: CORS_HEADERS })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' }, { status: 400, headers: CORS_HEADERS })
    }

    // Create auth user (email auto-confirmed, role = driver)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password.trim(),
      email_confirm: true,
      user_metadata: {
        role: 'driver',
        full_name: `${first_name.trim()} ${last_name.trim()}`,
      },
    })

    if (authError) {
      const msg = authError.message.toLowerCase()
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        return NextResponse.json({ error: 'Un compte existe déjà avec cette adresse e-mail.' }, { status: 400, headers: CORS_HEADERS })
      }
      return NextResponse.json({ error: authError.message }, { status: 400, headers: CORS_HEADERS })
    }

    // Create driver record with status: pending
    const { error: driverError } = await supabaseAdmin.from('drivers').insert({
      user_id: authData.user.id,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone: phone.trim(),
      status: 'pending',
    })

    if (driverError) {
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: 'Erreur lors de la création du compte.' }, { status: 500, headers: CORS_HEADERS })
    }

    // Email de bienvenue au chauffeur
    await sendEmail(
      email.trim().toLowerCase(),
      'Bienvenue chez O Taxi — Demande reçue',
      driverWelcomeHtml({ firstName: first_name.trim(), email: email.trim().toLowerCase() }),
    ).catch(() => {})

    // Notif in-app admin
    await createAdminNotification({
      type: 'new_driver',
      title: '👤 Nouveau chauffeur inscrit',
      body: `${first_name.trim()} ${last_name.trim()} — en attente de validation`,
      data: { driverUserId: authData.user.id },
    }).catch(() => {})

    return NextResponse.json({ success: true }, { headers: CORS_HEADERS })
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500, headers: CORS_HEADERS })
  }
}
