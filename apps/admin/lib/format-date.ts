/**
 * Utilitaires de formatage de date dans le fuseau Europe/Paris.
 *
 * Nécessaire parce que Vercel (Node.js) exécute les serveurs en UTC.
 * Sans `timeZone: 'Europe/Paris'` explicite, toLocaleString() et date-fns
 * format() affichent l'heure UTC — soit 2h de décalage en été (CEST).
 */

import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz'
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'

export const PARIS = 'Europe/Paris'

// ─── Formatage affichage ──────────────────────────────────────────────────────

/** "15/06/25 22h00" — utilisé dans les tableaux compacts */
export function fmtDateTime(ts: string | Date): string {
  const d = new Date(ts)
  const date = d.toLocaleDateString('fr-FR', { timeZone: PARIS, day: '2-digit', month: '2-digit', year: '2-digit' })
  const time = d.toLocaleTimeString('fr-FR', { timeZone: PARIS, hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
  return `${date} ${time}`
}

/** "dimanche 15 juin 2025 à 22h00" — utilisé dans les détails de course */
export function fmtDateTimeLong(ts: string | Date): string {
  const d = new Date(ts)
  const date = d.toLocaleDateString('fr-FR', { timeZone: PARIS, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = d.toLocaleTimeString('fr-FR', { timeZone: PARIS, hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
  return `${date} à ${time}`
}

/** "15 juin à 22h00" — utilisé dans les emails et alertes */
export function fmtDateShort(ts: string | Date): string {
  const d = new Date(ts)
  const date = d.toLocaleDateString('fr-FR', { timeZone: PARIS, day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('fr-FR', { timeZone: PARIS, hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
  return `${date} à ${time}`
}

/** "22h00" — utilisé dans les récapitulatifs */
export function fmtTime(ts: string | Date): string {
  return new Date(ts)
    .toLocaleTimeString('fr-FR', { timeZone: PARIS, hour: '2-digit', minute: '2-digit' })
    .replace(':', 'h')
}

/** "15/06/25 22:00" — compatible avec toLocaleString standard */
export function fmtDateTimeStd(ts: string | Date): string {
  return new Date(ts).toLocaleString('fr-FR', {
    timeZone: PARIS,
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Formatage avec pattern date-fns (ex: "EEEE d MMMM 'à' HH'h'mm").
 * Utilise formatInTimeZone de date-fns-tz pour respecter Europe/Paris.
 */
export function fmtPattern(ts: string | Date, pattern: string): string {
  return formatInTimeZone(new Date(ts), PARIS, pattern, { locale: fr })
}

// ─── Logique calendaire Paris ─────────────────────────────────────────────────

/** Heure courante en heure Paris (0–23) */
export function getParisHour(date: Date = new Date()): number {
  return toZonedTime(date, PARIS).getHours()
}

/** Début du jour J+offsetDays en heure Paris → ISO string UTC */
export function getParisDayStartISO(date: Date, offsetDays = 0): string {
  const parisNow = toZonedTime(date, PARIS)
  const target = new Date(parisNow)
  target.setDate(target.getDate() + offsetDays)
  return fromZonedTime(startOfDay(target), PARIS).toISOString()
}

/** Fin du jour J+offsetDays en heure Paris → ISO string UTC */
export function getParisDayEndISO(date: Date, offsetDays = 0): string {
  const parisNow = toZonedTime(date, PARIS)
  const target = new Date(parisNow)
  target.setDate(target.getDate() + offsetDays)
  return fromZonedTime(endOfDay(target), PARIS).toISOString()
}

/** Début du mois courant en heure Paris → ISO string UTC */
export function getParisMonthStartISO(date: Date): string {
  return fromZonedTime(startOfMonth(toZonedTime(date, PARIS)), PARIS).toISOString()
}

/** Fin du mois courant en heure Paris → ISO string UTC */
export function getParisMonthEndISO(date: Date): string {
  return fromZonedTime(endOfMonth(toZonedTime(date, PARIS)), PARIS).toISOString()
}
