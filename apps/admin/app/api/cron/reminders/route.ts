// Vercel cron job — runs every 5 minutes
// Handles: push reminder 1h, 15min; J-1 email; unassigned J-2d / J-2h alerts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendMobilePush, createAdminNotification, sendEmail } from '@/lib/notify'
import {
  bookingReminderDayBeforeHtml,
  bookingRecapHtml,
  adminDailyRecapHtml,
} from '@/lib/resend'
import { addHours } from 'date-fns'
import {
  fmtDateTimeLong, fmtDateShort, fmtTime,
  getParisHour, getParisDayStartISO, getParisDayEndISO,
} from '@/lib/format-date'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ─── Types locaux pour les jointures Supabase ─────────────────────────────────
type BookingForReminder = {
  id: string
  client_id: string | null
  pickup_address: string
  dropoff_address: string
  scheduled_at: string
  guest_email?: string | null
  profiles?: { full_name: string | null; email?: string | null } | null
  drivers?: { first_name: string; last_name: string } | null
}
type NotifPrefs = { push_reminder_1h?: boolean | null; push_reminder_15min?: boolean | null }

// Protect cron endpoint
function isAuthorized(req: NextRequest) {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results: string[] = []

  // ── 1h reminder push ──────────────────────────────────────
  const in1h = addHours(now, 1)
  const in1hFrom = addHours(now, 58)
  await sendTimeReminders(in1hFrom, in1h, '1h', '⏰ Votre course est dans 1 heure', results)

  // ── 15min reminder push ───────────────────────────────────
  const in15 = addHours(now, 0.25)
  const in15From = addHours(now, 0.20)
  await sendTimeReminders(in15From, in15, '15min', '🚗 Votre chauffeur arrive bientôt', results)

  // ── J-1 email (runs once a day à 8h Paris) ───────────────
  const hour = getParisHour(now)
  if (hour === 8) {
    await sendDayBeforeEmails(results)
    await sendAdminDailyRecap(results)
  }

  // ── Unassigned booking alerts ─────────────────────────────
  await checkUnassignedBookings(now, results)

  return NextResponse.json({ ok: true, results })
}

async function sendTimeReminders(
  from: Date,
  to: Date,
  label: string,
  pushTitle: string,
  results: string[],
) {
  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('id, client_id, pickup_address, dropoff_address, scheduled_at, profiles!client_id(full_name)')
    .in('status', ['confirmed', 'pending'])
    .not('client_id', 'is', null)
    .gte('scheduled_at', from.toISOString())
    .lte('scheduled_at', to.toISOString())

  if (!bookings?.length) return

  for (const bk of bookings) {
    const { data: prefs } = await supabaseAdmin
      .from('notification_preferences')
      .select(label === '1h' ? 'push_reminder_1h' : 'push_reminder_15min')
      .eq('user_id', bk.client_id)
      .maybeSingle()

    const prefKey = label === '1h' ? 'push_reminder_1h' : 'push_reminder_15min'
    if (prefs && (prefs as NotifPrefs)[prefKey] === false) continue

    await sendMobilePush(bk.client_id, {
      title: pushTitle,
      body: `${bk.pickup_address} → ${bk.dropoff_address}`,
      data: { bookingId: bk.id, screen: 'booking' },
    })
    results.push(`Reminder ${label} sent for booking ${bk.id}`)
  }
}

async function sendDayBeforeEmails(results: string[]) {
  const now = new Date()
  const from = new Date(getParisDayStartISO(now, 1))
  const to = new Date(getParisDayEndISO(now, 1))

  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select(`
      id, pickup_address, dropoff_address, scheduled_at, client_id, guest_email,
      profiles!client_id(full_name, email),
      drivers!driver_id(first_name, last_name)
    `)
    .in('status', ['confirmed', 'pending'])
    .gte('scheduled_at', from.toISOString())
    .lte('scheduled_at', to.toISOString())

  if (!bookings?.length) return

  for (const bk of bookings as BookingForReminder[]) {
    const clientEmail = bk.profiles?.email ?? bk.guest_email
    const clientName = bk.profiles?.full_name ?? 'Client'
    const driverName = bk.drivers
      ? `${bk.drivers.first_name} ${bk.drivers.last_name}`
      : undefined

    if (!clientEmail) continue

    const { data: prefs } = await supabaseAdmin
      .from('notification_preferences')
      .select('email_reminder_day_before')
      .eq('user_id', bk.client_id)
      .maybeSingle()

    if (prefs?.email_reminder_day_before === false) continue

    await sendEmail(
      clientEmail,
      'Rappel — Votre course O Taxi demain',
      bookingReminderDayBeforeHtml({
        clientName,
        pickup: bk.pickup_address,
        dropoff: bk.dropoff_address,
        scheduledAt: fmtDateTimeLong(bk.scheduled_at),
        driverName,
      }),
    )
    results.push(`J-1 email sent for booking ${bk.id}`)
  }
}

async function sendAdminDailyRecap(results: string[]) {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return

  const now = new Date()
  const from = new Date(getParisDayStartISO(now, 1))
  const to = new Date(getParisDayEndISO(now, 1))

  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select(`
      id, pickup_address, dropoff_address, scheduled_at,
      profiles!client_id(full_name),
      drivers!driver_id(first_name, last_name)
    `)
    .in('status', ['confirmed', 'pending'])
    .gte('scheduled_at', from.toISOString())
    .lte('scheduled_at', to.toISOString())
    .order('scheduled_at')

  if (!bookings?.length) return

  const dateStr = from.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' })
  await sendEmail(
    adminEmail,
    `O Taxi — ${bookings.length} course(s) demain ${dateStr}`,
    adminDailyRecapHtml({
      date: dateStr,
      bookings: (bookings as BookingForReminder[]).map(bk => ({
        time: fmtTime(bk.scheduled_at),
        client: bk.profiles?.full_name ?? 'Invité',
        pickup: bk.pickup_address,
        dropoff: bk.dropoff_address,
        driver: bk.drivers
          ? `${bk.drivers.first_name} ${bk.drivers.last_name}`
          : undefined,
      })),
    }),
  )
  results.push(`Admin daily recap sent`)
}

async function checkUnassignedBookings(now: Date, results: string[]) {
  // J-2j: 48h avant
  const in48h = addHours(now, 48)
  const in49h = addHours(now, 49)

  const { data: unassigned48 } = await supabaseAdmin
    .from('bookings')
    .select('id, pickup_address, dropoff_address, scheduled_at')
    .eq('status', 'pending')
    .is('driver_id', null)
    .gte('scheduled_at', in48h.toISOString())
    .lte('scheduled_at', in49h.toISOString())

  for (const bk of unassigned48 ?? []) {
    await createAdminNotification({
      type: 'unassigned_urgent',
      title: '⚠️ Course non assignée (J-2)',
      body: `${bk.pickup_address} → ${bk.dropoff_address} — ${fmtDateShort(bk.scheduled_at)}`,
      data: { bookingId: bk.id },
    })
    results.push(`Unassigned J-2d alert for ${bk.id}`)
  }

  // J-2h: 2h avant
  const in2h = addHours(now, 2)
  const in2h10 = addHours(now, 2.1)

  const { data: unassigned2h } = await supabaseAdmin
    .from('bookings')
    .select('id, pickup_address, dropoff_address, scheduled_at')
    .eq('status', 'pending')
    .is('driver_id', null)
    .gte('scheduled_at', in2h.toISOString())
    .lte('scheduled_at', in2h10.toISOString())

  for (const bk of unassigned2h ?? []) {
    await createAdminNotification({
      type: 'unassigned_urgent',
      title: '🚨 URGENT — Course non assignée (2h)',
      body: `${bk.pickup_address} → ${bk.dropoff_address} — ${fmtTime(bk.scheduled_at)}`,
      data: { bookingId: bk.id },
    })
    results.push(`Unassigned J-2h alert for ${bk.id}`)
  }
}
