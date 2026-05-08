import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/AdminLayout'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  notifyClientStatusChange,
  notifyDriverCancelled,
  notifyDriverAssigned,
  broadcastWebPushToAllDrivers,
  createAdminNotification,
  sendEmail,
  sendMobilePush,
} from '@/lib/notify'
import { bookingRecapHtml } from '@/lib/resend'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { fmtDateShort } from '@/lib/format-date'
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Star, UserX, Ban, Megaphone, FileText, Cross } from '@/components/Icons'

type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'refused' | 'cancelled' | 'no_show' | 'cancellation_requested'

async function updateBookingStatus(bookingId: string, newStatus: BookingStatus, comment?: string) {
  'use server'
  const supabase = createClient()

  // Fetch booking + client info for notifications
  const { data: bk } = await supabase
    .from('bookings')
    .select('client_id, driver_id, pickup_address, dropoff_address, scheduled_at, base_price, points_credited, profiles!client_id(full_name, email), drivers!driver_id(user_id, first_name, last_name)')
    .eq('id', bookingId)
    .single()

  const { error: updateError } = await supabase
    .from('bookings')
    .update({ status: newStatus })
    .eq('id', bookingId)

  if (updateError) throw new Error(updateError.message)

  await supabase.from('booking_status_history').insert({
    booking_id: bookingId,
    status: newStatus,
    changed_by: 'admin',
    comment: comment ?? null,
  })

  revalidatePath(`/bookings/${bookingId}`)
  revalidatePath('/bookings')
  revalidatePath('/dashboard')

  // ── Notifications ──
  if (!bk) return

  const statusLabels: Partial<Record<BookingStatus, string>> = {
    confirmed: '✅ Course confirmée',
    refused: '❌ Course refusée',
    cancelled: '❌ Course annulée',
    in_progress: '🚕 Chauffeur en route',
    completed: '✅ Course terminée',
    no_show: '⚠️ No-show enregistré',
    pending: '🔄 Course remise en attente',
  }

  const label = statusLabels[newStatus]
  if (label && bk.client_id) {
    await notifyClientStatusChange(bk.client_id, (bk as any).profiles?.email ?? null, {
      title: label,
      body: `${bk.pickup_address} → ${bk.dropoff_address}`,
      data: { bookingId, screen: 'booking' },
    })
  }

  // Email recap après complétion
  if (newStatus === 'completed') {
    const clientEmail = (bk as any).profiles?.email
    if (clientEmail && bk.client_id) {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('email_booking_recap')
        .eq('user_id', bk.client_id)
        .maybeSingle()

      if (!prefs || prefs.email_booking_recap !== false) {
        await sendEmail(
          clientEmail,
          'Récapitulatif de votre course O Taxi',
          bookingRecapHtml({
            clientName: (bk as any).profiles?.full_name ?? 'Client',
            pickup: bk.pickup_address,
            dropoff: bk.dropoff_address,
            completedAt: format(new Date(), "d MMMM yyyy 'à' HH'h'mm", { locale: fr }),
            price: `${bk.base_price}€`,
            pointsEarned: bk.points_credited ?? undefined,
          }),
        )
      }
    }
  }

  // No-show → notif admin
  if (newStatus === 'no_show') {
    await createAdminNotification({
      type: 'no_show',
      title: '🚨 No-show signalé',
      body: `${(bk as any).profiles?.full_name ?? 'Client'} — ${bk.pickup_address}`,
      data: { bookingId },
    })
  }

  // Cancelled → notif chauffeur si assigné
  if (newStatus === 'cancelled' && (bk as any).drivers?.user_id) {
    await notifyDriverCancelled((bk as any).drivers.user_id, {
      title: '❌ Course annulée',
      body: `${bk.pickup_address} → ${bk.dropoff_address}`,
      data: { bookingId, url: `/driver/bookings/${bookingId}` },
    })
  }
}

export default async function BookingDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, profiles!client_id(full_name, phone, email)')
    .eq('id', params.id)
    .single()

  if (!booking) notFound()

  // Signed URL for attestation (private bucket)
  let attestationSignedUrl: string | null = null
  const rawAttestationUrl = (booking as any).attestation_url as string | null
  if (rawAttestationUrl) {
    const pathMatch = rawAttestationUrl.match(/\/attestations\/(.+)$/)
    if (pathMatch) {
      const { data: signed } = await supabase.storage
        .from('attestations')
        .createSignedUrl(decodeURIComponent(pathMatch[1]), 3600)
      attestationSignedUrl = signed?.signedUrl ?? rawAttestationUrl
    } else {
      attestationSignedUrl = rawAttestationUrl
    }
  }

  const { data: history } = await supabase
    .from('booking_status_history')
    .select('*')
    .eq('booking_id', params.id)
    .order('changed_at', { ascending: false })

  // Fetch assigned driver (optional — requires migration 006)
  let assignedDriver: { id: string; first_name: string; last_name: string; phone: string | null } | null = null
  let approvedDrivers: { id: string; first_name: string; last_name: string; phone: string | null }[] = []
  try {
    if ((booking as any).driver_id) {
      const { data } = await supabase
        .from('drivers')
        .select('id, first_name, last_name, phone')
        .eq('id', (booking as any).driver_id)
        .single()
      assignedDriver = data
    }
    const { data: driverList } = await supabase
      .from('drivers')
      .select('id, first_name, last_name, phone')
      .eq('status', 'approved')
      .order('last_name')
    approvedDrivers = driverList ?? []
  } catch {
    // drivers table not yet created — migration 006 pending
  }

  const canConfirm   = booking.status === 'pending'
  const canRefuse    = booking.status === 'pending'
  const canRevertPending = booking.status === 'confirmed'
  const scheduledPast  = new Date(booking.scheduled_at) <= new Date()
  const canComplete  = (booking.status === 'confirmed' || booking.status === 'in_progress') && scheduledPast
  const canNoShow    = booking.status === 'confirmed' || booking.status === 'in_progress'
  const canCancel    = booking.status === 'confirmed'
  const canApproveCancelRequest = booking.status === 'cancellation_requested'
  const canAssignDriver = ['pending', 'confirmed'].includes(booking.status)
  const isBroadcast = !!(booking as any).is_broadcast

  // ── Server Actions ──

  const confirmAction = async () => {
    'use server'
    await updateBookingStatus(params.id, 'confirmed')
    redirect(`/bookings/${params.id}`)
  }

  const refuseWithCommentAction = async (formData: FormData) => {
    'use server'
    const comment = formData.get('refusal_comment') as string | null
    const supabase = createClient()
    await supabase
      .from('bookings')
      .update({ status: 'refused', refusal_comment: comment?.trim() || null })
      .eq('id', params.id)
    await supabase.from('booking_status_history').insert({
      booking_id: params.id,
      status: 'refused',
      changed_by: 'admin',
      comment: comment?.trim() || null,
    })
    revalidatePath(`/bookings/${params.id}`)
    revalidatePath('/bookings')
    revalidatePath('/dashboard')
    redirect(`/bookings/${params.id}`)
  }

  const revertPendingAction = async () => {
    'use server'
    await updateBookingStatus(params.id, 'pending', 'Retour en attente (chauffeur désisté)')
    redirect(`/bookings/${params.id}`)
  }

  const completeAction = async () => {
    'use server'
    const supabase = createClient()
    const { data: bk } = await supabase
      .from('bookings')
      .select('client_id, base_price')
      .eq('id', params.id)
      .single()

    await supabase.from('bookings').update({ status: 'completed' }).eq('id', params.id)
    await supabase.from('booking_status_history').insert({
      booking_id: params.id,
      status: 'completed',
      changed_by: 'admin',
    })

    if (bk?.client_id && bk?.base_price) {
      const points = Math.floor(Number(bk.base_price))
      if (points > 0) {
        await supabase.rpc('credit_loyalty_points', {
          p_client_id: bk.client_id,
          p_booking_id: params.id,
          p_points: points,
        })
        await supabase
          .from('bookings')
          .update({ points_credited: points })
          .eq('id', params.id)
      }
    }

    revalidatePath(`/bookings/${params.id}`)
    revalidatePath('/bookings')
    revalidatePath('/dashboard')
    redirect(`/bookings/${params.id}`)
  }

  const noShowAction = async () => {
    'use server'
    await updateBookingStatus(params.id, 'no_show')
    redirect(`/bookings/${params.id}`)
  }

  const cancelAction = async () => {
    'use server'
    await updateBookingStatus(params.id, 'cancelled')
    redirect(`/bookings/${params.id}`)
  }

  const approveCancelRequestAction = async () => {
    'use server'
    // Remet en "pending" pour qu'un autre chauffeur puisse être assigné
    const supabase = createClient()
    await supabase.from('bookings')
      .update({ status: 'pending', driver_id: null })
      .eq('id', params.id)
    await supabase.from('booking_status_history').insert({
      booking_id: params.id,
      status: 'pending',
      changed_by: 'admin',
      comment: 'Annulation chauffeur approuvée — remis en attente de réassignation',
    })
    revalidatePath(`/bookings/${params.id}`)
    revalidatePath('/bookings')
    revalidatePath('/dashboard')
    redirect(`/bookings/${params.id}`)
  }

  const refuseCancelRequestAction = async () => {
    'use server'
    await updateBookingStatus(params.id, 'confirmed', 'Demande d\'annulation chauffeur refusée — course maintenue')
    redirect(`/bookings/${params.id}`)
  }

  const assignDriverAction = async (formData: FormData) => {
    'use server'
    const driverId = formData.get('driver_id') as string | null
    const supabase = createClient()

    // Get driver user_id for notification
    let driverUserId: string | null = null
    if (driverId) {
      const { data: driverRow } = await supabase
        .from('drivers')
        .select('user_id, first_name, last_name')
        .eq('id', driverId)
        .single()
      driverUserId = driverRow?.user_id ?? null

      if (driverUserId) {
        // Notify driver
        await notifyDriverAssigned(driverUserId, {
          title: '📌 Nouvelle course assignée',
          body: `${booking.pickup_address} → ${booking.dropoff_address}`,
          data: { bookingId: params.id, url: `/driver/bookings/${params.id}` },
        })
        // Notify client
        if (booking.client_id) {
          await notifyClientStatusChange(booking.client_id, (booking as any).profiles?.email ?? null, {
            title: `🚗 Chauffeur assigné — ${driverRow?.first_name} ${driverRow?.last_name}`,
            body: `Votre course du ${booking.pickup_address} est prise en charge.`,
            data: { bookingId: params.id, screen: 'booking' },
          })
        }
      }
    }

    await supabase
      .from('bookings')
      .update({ driver_id: driverId || null, is_broadcast: false })
      .eq('id', params.id)
    revalidatePath(`/bookings/${params.id}`)
    redirect(`/bookings/${params.id}`)
  }

  const broadcastAction = async () => {
    'use server'
    const supabase = createClient()
    await supabase
      .from('bookings')
      .update({ is_broadcast: true, driver_id: null })
      .eq('id', params.id)
    await supabase.from('booking_status_history').insert({
      booking_id: params.id,
      status: booking.status,
      changed_by: 'admin',
      comment: 'Course envoyée à tous les chauffeurs disponibles',
    })
    // Web push to all approved drivers
    await broadcastWebPushToAllDrivers({
      title: '🔔 Nouvelle course disponible',
      body: `${booking.pickup_address} → ${booking.dropoff_address}`,
      data: { bookingId: params.id, url: `/driver/search` },
    })
    revalidatePath(`/bookings/${params.id}`)
    redirect(`/bookings/${params.id}`)
  }

  const cancelBroadcastAction = async () => {
    'use server'
    const supabase = createClient()
    await supabase.from('bookings').update({ is_broadcast: false }).eq('id', params.id)
    revalidatePath(`/bookings/${params.id}`)
    redirect(`/bookings/${params.id}`)
  }

  const uploadAttestationAction = async (formData: FormData) => {
    'use server'
    const supabase = createClient()
    const file = formData.get('attestation') as File | null
    if (!file || file.size === 0) return
    const path = `${params.id}/${Date.now()}.pdf`
    const arrayBuffer = await file.arrayBuffer()
    const { data: uploadData, error } = await supabase.storage
      .from('attestations')
      .upload(path, Buffer.from(arrayBuffer), { contentType: 'application/pdf', upsert: true })
    if (!error && uploadData) {
      const { data: urlData } = supabase.storage.from('attestations').getPublicUrl(uploadData.path)
      await supabase.from('bookings').update({ attestation_url: urlData.publicUrl }).eq('id', params.id)
    }
    revalidatePath(`/bookings/${params.id}`)
    redirect(`/bookings/${params.id}`)
  }

  const tariffLabels: Record<string, string> = {
    A: 'Tarif A — Jour (6h–21h)',
    B: 'Tarif B — Nuit / WE / Férié',
    C: 'Tarif C — Longue distance jour',
    D: 'Tarif D — Longue distance nuit',
  }

  return (
    <AdminLayout>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/bookings" className="text-gray-400 hover:text-gray-600 text-sm transition-colors">
                ← Réservations
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Détail de la réservation</h1>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{booking.id}</p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        {/* Cancellation request banner */}
        {booking.status === 'cancellation_requested' && (
          <div className="mb-6 bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900">Le chauffeur a demandé l'annulation de cette course</p>
              <p className="text-sm text-amber-700 mt-1">Approuvez ou refusez la demande pour continuer.</p>
            </div>
            <div className="flex gap-2">
              <form action={approveCancelRequestAction}>
                <button type="submit" className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  Approuver l'annulation
                </button>
              </form>
              <form action={refuseCancelRequestAction}>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  Refuser — Maintenir la course
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4 text-base">Informations client</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500 font-medium">Nom</dt>
                  <dd className="text-gray-900 mt-0.5">
                    {(booking as any).profiles?.full_name ?? booking.guest_name ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium">Téléphone</dt>
                  <dd className="text-gray-900 mt-0.5">
                    {(booking as any).profiles?.phone ?? booking.guest_phone ?? '—'}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-gray-500 font-medium">Email</dt>
                  <dd className="text-gray-900 mt-0.5">
                    {(booking as any).profiles?.email ?? booking.guest_email ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium">Type de client</dt>
                  <dd className="mt-0.5">
                    {booking.client_id
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Compte enregistré</span>
                      : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Invité</span>
                    }
                  </dd>
                </div>
              </dl>
            </div>

            {/* Trip details */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4 text-base">Détails du trajet</h2>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-gray-500 font-medium mb-1">Adresse de départ</dt>
                  <dd className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{booking.pickup_address}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium mb-1">Adresse d&apos;arrivée</dt>
                  <dd className="text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{booking.dropoff_address}</dd>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-gray-500 font-medium">Date et heure</dt>
                    <dd className="text-gray-900 mt-0.5 font-medium">
                      {new Date(booking.scheduled_at).toLocaleString('fr-FR', {
                        timeZone: 'Europe/Paris',
                        weekday: 'long', day: '2-digit', month: 'long',
                        year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500 font-medium">Type de course</dt>
                    <dd className="text-gray-900 mt-0.5">
                      {booking.trip_type === 'round_trip' ? 'Aller-retour' : 'Aller simple'}
                    </dd>
                  </div>
                  {booking.distance_km != null && (
                    <div>
                      <dt className="text-gray-500 font-medium">Distance</dt>
                      <dd className="text-gray-900 mt-0.5">{booking.distance_km} km</dd>
                    </div>
                  )}
                  {booking.duration_min != null && (
                    <div>
                      <dt className="text-gray-500 font-medium">Durée estimée</dt>
                      <dd className="text-gray-900 mt-0.5">{booking.duration_min} min</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-gray-500 font-medium">Conventionné</dt>
                    <dd className="text-gray-900 mt-0.5">{booking.is_conventional ? 'Oui' : 'Non'}</dd>
                  </div>
                </div>
              </dl>
            </div>

            {/* Price breakdown */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4 text-base">Tarification</h2>
              <dl className="space-y-3 text-sm">
                {booking.tariff_code && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Code tarif</dt>
                    <dd className="text-gray-900 font-medium">{tariffLabels[booking.tariff_code] ?? booking.tariff_code}</dd>
                  </div>
                )}
                {booking.base_price != null && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Prix de base</dt>
                    <dd className="text-gray-900 font-semibold">{booking.base_price.toFixed(2)} €</dd>
                  </div>
                )}
                {booking.estimated_min != null && booking.estimated_max != null && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Fourchette estimée</dt>
                    <dd className="text-gray-900">{booking.estimated_min} – {booking.estimated_max} €</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Attestation PDF */}
            {booking.is_conventional && (
              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-400">
                <h2 className="font-semibold text-gray-900 mb-3 text-base flex items-center gap-2">
                  <Cross className="w-4 h-4 text-purple-600" /> Attestation conventionnée
                </h2>
                {attestationSignedUrl ? (
                  <>
                    <a
                      href={attestationSignedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 font-medium bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <FileText className="w-4 h-4" /> Télécharger l'attestation PDF
                    </a>
                    <p className="text-xs text-gray-400 mt-2">Lien valide 1 heure — rechargez la page si expiré.</p>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      Aucune attestation jointe par le client.
                    </p>
                    <form action={uploadAttestationAction} className="flex items-center gap-2">
                      <input
                        type="file"
                        name="attestation"
                        accept=".pdf,application/pdf"
                        required
                        className="text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                      />
                      <button
                        type="submit"
                        className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition-colors"
                      >
                        Joindre
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* Cancellation / refusal info */}
            {(booking as any).cancellation_reason && (
              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-400">
                <h2 className="font-semibold text-gray-900 mb-2 text-base">Motif d'annulation client</h2>
                <p className="text-sm text-gray-700">{(booking as any).cancellation_reason}</p>
              </div>
            )}
            {(booking as any).refusal_comment && (
              <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-red-400">
                <h2 className="font-semibold text-gray-900 mb-2 text-base">Commentaire de refus</h2>
                <p className="text-sm text-gray-700">{(booking as any).refusal_comment}</p>
              </div>
            )}

            {/* Notes */}
            {booking.notes && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-3 text-base">Notes</h2>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3">{booking.notes}</p>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Actions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4 text-base">Actions</h2>
              <div className="space-y-3">
                {canConfirm && (
                  <form action={confirmAction}>
                    <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Confirmer la réservation
                    </button>
                  </form>
                )}
                {canRefuse && (
                  <form action={refuseWithCommentAction} className="space-y-2">
                    <textarea
                      name="refusal_comment"
                      placeholder="Commentaire de refus (optionnel, visible par le client)"
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                    />
                    <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                      <XCircle className="w-4 h-4" /> Refuser la réservation
                    </button>
                  </form>
                )}
                {canRevertPending && (
                  <form action={revertPendingAction}>
                    <button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4" /> Retour en attente
                    </button>
                  </form>
                )}
                {canComplete && (
                  <form action={completeAction}>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                      <Star className="w-4 h-4" /> Marquer comme effectuée
                    </button>
                  </form>
                )}
                {(booking.status === 'confirmed' || booking.status === 'in_progress') && !scheduledPast && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700">
                      Course prévue le {fmtDateShort(booking.scheduled_at)} — disponible après la prise en charge.
                    </p>
                  </div>
                )}
                {canNoShow && (
                  <form action={noShowAction}>
                    <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                      <UserX className="w-4 h-4" /> No-show
                    </button>
                  </form>
                )}
                {canCancel && (
                  <form action={cancelAction}>
                    <button type="submit" className="w-full bg-gray-500 hover:bg-gray-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                      <Ban className="w-4 h-4" /> Annuler
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Driver assignment */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4 text-base">Chauffeur assigné</h2>
              {assignedDriver ? (
                <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-green-800">
                    {assignedDriver.first_name} {assignedDriver.last_name}
                  </p>
                  {assignedDriver.phone && (
                    <p className="text-xs text-green-700 mt-0.5">{assignedDriver.phone}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 mb-3">Aucun chauffeur assigné</p>
              )}
              {canAssignDriver && (
                <form action={assignDriverAction} className="space-y-2">
                  <select
                    name="driver_id"
                    defaultValue={(booking as any).driver_id ?? ''}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Aucun chauffeur —</option>
                    {(approvedDrivers ?? []).map(d => (
                      <option key={d.id} value={d.id}>
                        {d.first_name} {d.last_name}{d.phone ? ` (${d.phone})` : ''}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm">
                    Assigner
                  </button>
                </form>
              )}

              {/* Broadcast */}
              {canAssignDriver && (
                <div className="pt-2 border-t border-gray-100">
                  {isBroadcast ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                        <Megaphone className="w-4 h-4 text-blue-600" />
                        <span className="text-xs text-blue-700 font-medium">
                          Envoyée à tous les chauffeurs
                        </span>
                      </div>
                      <form action={cancelBroadcastAction}>
                        <button type="submit" className="w-full text-gray-600 border border-gray-300 hover:bg-gray-50 font-medium py-2 px-4 rounded-lg transition-colors text-xs">
                          Annuler le broadcast
                        </button>
                      </form>
                    </div>
                  ) : (
                    <form action={broadcastAction}>
                      <button type="submit" className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-medium py-2.5 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                        <Megaphone className="w-4 h-4" /> Envoyer à tous les chauffeurs
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Status history */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4 text-base">Historique des statuts</h2>
              {!history || history.length === 0 ? (
                <p className="text-sm text-gray-400">Aucun historique disponible</p>
              ) : (
                <div className="space-y-3">
                  {history.map((entry, i) => (
                    <div key={entry.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                        {i < history.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                      </div>
                      <div className="pb-3">
                        <div className="flex items-center gap-2 mb-0.5">
                          <StatusBadge status={entry.status} />
                          {entry.changed_by && <span className="text-xs text-gray-400">par {entry.changed_by}</span>}
                        </div>
                        <p className="text-xs text-gray-400">
                          {new Date(entry.changed_at).toLocaleString('fr-FR', {
                            timeZone: 'Europe/Paris',
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                        {entry.comment && (
                          <p className="text-xs text-gray-600 mt-1 italic">{entry.comment}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4 text-base">Métadonnées</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Créée le</dt>
                  <dd className="text-gray-900 text-xs">
                    {new Date(booking.created_at).toLocaleString('fr-FR', {
                      timeZone: 'Europe/Paris',
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </dd>
                </div>
                {booking.points_credited != null && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Points crédités</dt>
                    <dd className="text-gray-900">{booking.points_credited}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
    </AdminLayout>
  )
}
