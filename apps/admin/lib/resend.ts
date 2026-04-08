import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

export const FROM_EMAIL = 'Obaid Taxi <onboarding@resend.dev>'

// ── Email templates ──────────────────────────────────────────

export function bookingConfirmedHtml(data: {
  clientName: string
  pickup: string
  dropoff: string
  scheduledAt: string
  estimatedPrice: string
  bookingId: string
}) {
  return `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <div style="background:#1D4ED8;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
      <h1 style="color:#fff;margin:0;font-size:22px">🚗 Réservation confirmée</h1>
    </div>
    <p style="color:#374151">Bonjour <strong>${data.clientName}</strong>,</p>
    <p style="color:#374151">Votre réservation a bien été enregistrée. Voici le récapitulatif :</p>
    <div style="background:#F9FAFB;border-radius:12px;padding:20px;margin:20px 0">
      <p style="margin:8px 0;color:#374151"><strong>📍 Départ :</strong> ${data.pickup}</p>
      <p style="margin:8px 0;color:#374151"><strong>🏁 Destination :</strong> ${data.dropoff}</p>
      <p style="margin:8px 0;color:#374151"><strong>🕐 Date :</strong> ${data.scheduledAt}</p>
      <p style="margin:8px 0;color:#1D4ED8"><strong>💶 Tarif estimé :</strong> ${data.estimatedPrice}</p>
    </div>
    <p style="color:#6B7280;font-size:13px">Référence : #${data.bookingId.slice(0, 8).toUpperCase()}</p>
    <p style="color:#374151">Un chauffeur vous sera assigné prochainement. Vous recevrez une notification dès la confirmation.</p>
    <p style="color:#6B7280;font-size:13px;margin-top:32px;border-top:1px solid #E5E7EB;padding-top:16px">
      Obaid Taxi — Ne répondez pas à cet e-mail.
    </p>
  </div>`
}

export function bookingReminderDayBeforeHtml(data: {
  clientName: string
  pickup: string
  dropoff: string
  scheduledAt: string
  driverName?: string
}) {
  return `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <div style="background:#059669;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
      <h1 style="color:#fff;margin:0;font-size:22px">⏰ Rappel — Course demain</h1>
    </div>
    <p style="color:#374151">Bonjour <strong>${data.clientName}</strong>,</p>
    <p style="color:#374151">Rappel : vous avez une course programmée <strong>demain</strong>.</p>
    <div style="background:#F9FAFB;border-radius:12px;padding:20px;margin:20px 0">
      <p style="margin:8px 0;color:#374151"><strong>📍 Départ :</strong> ${data.pickup}</p>
      <p style="margin:8px 0;color:#374151"><strong>🏁 Destination :</strong> ${data.dropoff}</p>
      <p style="margin:8px 0;color:#374151"><strong>🕐 Date :</strong> ${data.scheduledAt}</p>
      ${data.driverName ? `<p style="margin:8px 0;color:#374151"><strong>🚗 Chauffeur :</strong> ${data.driverName}</p>` : ''}
    </div>
    <p style="color:#6B7280;font-size:13px;margin-top:32px;border-top:1px solid #E5E7EB;padding-top:16px">
      Obaid Taxi — Ne répondez pas à cet e-mail.
    </p>
  </div>`
}

export function bookingRecapHtml(data: {
  clientName: string
  pickup: string
  dropoff: string
  completedAt: string
  price: string
  pointsEarned?: number
}) {
  return `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <div style="background:#7C3AED;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
      <h1 style="color:#fff;margin:0;font-size:22px">✅ Course terminée</h1>
    </div>
    <p style="color:#374151">Bonjour <strong>${data.clientName}</strong>,</p>
    <p style="color:#374151">Merci d'avoir voyagé avec Obaid Taxi. Voici le récapitulatif de votre course :</p>
    <div style="background:#F9FAFB;border-radius:12px;padding:20px;margin:20px 0">
      <p style="margin:8px 0;color:#374151"><strong>📍 Départ :</strong> ${data.pickup}</p>
      <p style="margin:8px 0;color:#374151"><strong>🏁 Destination :</strong> ${data.dropoff}</p>
      <p style="margin:8px 0;color:#374151"><strong>🕐 Effectuée le :</strong> ${data.completedAt}</p>
      <p style="margin:8px 0;color:#1D4ED8"><strong>💶 Montant :</strong> ${data.price}</p>
      ${data.pointsEarned ? `<p style="margin:8px 0;color:#D97706"><strong>⭐ Points gagnés :</strong> +${data.pointsEarned} pts</p>` : ''}
    </div>
    <p style="color:#6B7280;font-size:13px;margin-top:32px;border-top:1px solid #E5E7EB;padding-top:16px">
      Obaid Taxi — Ne répondez pas à cet e-mail.
    </p>
  </div>`
}

export function driverWelcomeHtml(data: { firstName: string; email: string }) {
  return `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <div style="background:#1D4ED8;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
      <h1 style="color:#fff;margin:0;font-size:22px">🚗 Bienvenue chez Obaid Taxi !</h1>
    </div>
    <p style="color:#374151">Bonjour <strong>${data.firstName}</strong>,</p>
    <p style="color:#374151">Votre demande d'inscription en tant que chauffeur a bien été reçue.</p>
    <div style="background:#FEF3C7;border-radius:12px;padding:16px;margin:20px 0;border-left:4px solid #D97706">
      <p style="color:#92400E;margin:0"><strong>⏳ Compte en cours de vérification</strong></p>
      <p style="color:#92400E;margin:8px 0 0">Notre équipe va examiner votre dossier sous 24h. Vous recevrez un e-mail dès validation.</p>
    </div>
    <p style="color:#374151">Vous pouvez vous connecter à l'espace chauffeur à tout moment pour suivre l'état de votre compte.</p>
    <p style="color:#6B7280;font-size:13px;margin-top:32px;border-top:1px solid #E5E7EB;padding-top:16px">
      Obaid Taxi — Ne répondez pas à cet e-mail.
    </p>
  </div>`
}

export function driverApprovedHtml(data: { firstName: string }) {
  return `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <div style="background:#059669;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
      <h1 style="color:#fff;margin:0;font-size:22px">✅ Compte approuvé !</h1>
    </div>
    <p style="color:#374151">Bonjour <strong>${data.firstName}</strong>,</p>
    <p style="color:#374151">Bonne nouvelle ! Votre compte chauffeur a été <strong>validé</strong>.</p>
    <p style="color:#374151">Vous pouvez maintenant vous connecter à l'espace chauffeur et commencer à accepter des courses.</p>
    <div style="text-align:center;margin:24px 0">
      <p style="color:#374151;font-weight:600">🚗 Prends la route avec nous !</p>
    </div>
    <p style="color:#6B7280;font-size:13px;margin-top:32px;border-top:1px solid #E5E7EB;padding-top:16px">
      Obaid Taxi — Ne répondez pas à cet e-mail.
    </p>
  </div>`
}

export function adminDailyRecapHtml(data: {
  date: string
  bookings: { time: string; pickup: string; dropoff: string; client: string; driver?: string }[]
}) {
  const rows = data.bookings.map(b => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #E5E7EB;color:#374151">${b.time}</td>
      <td style="padding:10px;border-bottom:1px solid #E5E7EB;color:#374151">${b.client}</td>
      <td style="padding:10px;border-bottom:1px solid #E5E7EB;color:#374151">${b.pickup} → ${b.dropoff}</td>
      <td style="padding:10px;border-bottom:1px solid #E5E7EB;color:${b.driver ? '#374151' : '#EF4444'}">${b.driver ?? '⚠️ Non assigné'}</td>
    </tr>`).join('')

  return `
  <div style="font-family:sans-serif;max-width:680px;margin:0 auto;padding:24px">
    <div style="background:#1D4ED8;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
      <h1 style="color:#fff;margin:0;font-size:22px">📋 Courses du ${data.date}</h1>
    </div>
    <p style="color:#374151"><strong>${data.bookings.length}</strong> course(s) programmée(s) pour demain.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px">
      <thead>
        <tr style="background:#F9FAFB">
          <th style="padding:10px;text-align:left;color:#6B7280;font-size:13px">Heure</th>
          <th style="padding:10px;text-align:left;color:#6B7280;font-size:13px">Client</th>
          <th style="padding:10px;text-align:left;color:#6B7280;font-size:13px">Trajet</th>
          <th style="padding:10px;text-align:left;color:#6B7280;font-size:13px">Chauffeur</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#6B7280;font-size:13px;margin-top:32px;border-top:1px solid #E5E7EB;padding-top:16px">
      Obaid Taxi — Récapitulatif automatique quotidien.
    </p>
  </div>`
}
