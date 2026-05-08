import type { BookingStatus } from './types'

/**
 * Détermine si une réservation peut être annulée par le client.
 *
 * Règles métier :
 * - `pending`   → annulation libre, à tout moment
 * - `confirmed` → annulation possible uniquement si > 2h avant le départ
 * - Tout autre statut → non annulable
 *
 * @param status      Statut actuel de la réservation
 * @param scheduledAt Date/heure du départ (ISO string ou Date)
 * @returns true si l'annulation est autorisée
 */
export function canCancel(status: BookingStatus, scheduledAt: string | Date): boolean {
  if (status === 'pending') return true
  if (status === 'confirmed') {
    return !isWithin2Hours(scheduledAt)
  }
  return false
}

/**
 * Retourne true si le départ est dans moins de 2 heures (ou déjà passé).
 * Utilisé pour bloquer l'annulation tardive des courses confirmées.
 *
 * @param scheduledAt Date/heure du départ (ISO string ou Date)
 */
export function isWithin2Hours(scheduledAt: string | Date): boolean {
  const twoHoursMs = 2 * 60 * 60 * 1000
  const scheduledTime = typeof scheduledAt === 'string' ? new Date(scheduledAt) : scheduledAt
  return scheduledTime.getTime() - Date.now() < twoHoursMs
}
