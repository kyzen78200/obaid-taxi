import type { TariffCode, TripType, PriceEstimate } from './types'

// ─── Constantes tarifaires ────────────────────────────────────────────────────

const BASE_CHARGE = 2.94
const MIN_FARE = 8.0
const MARGIN = 1.35

/** Tarifs kilométriques par code */
const RATES: Record<TariffCode, number> = {
  A: 0.99, // Aller-retour Jour
  B: 1.49, // Aller-retour Nuit
  C: 1.98, // Aller simple Jour
  D: 2.97, // Aller simple Nuit
}

/** Heure de début de la tranche nuit (19h) */
const NIGHT_START_HOUR = 19
/** Heure de fin de la tranche nuit (8h) */
const NIGHT_END_HOUR = 8

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retourne true si l'heure donnée est en tranche nuit (19h-8h) */
function isNightHour(hour: number): boolean {
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR
}

/** Arrondit à l'euro supérieur */
function ceilEuro(amount: number): number {
  return Math.ceil(amount)
}

/**
 * Détermine le code tarif selon le type de course et la tranche horaire.
 * A = Aller-retour Jour, B = Aller-retour Nuit, C = Aller simple Jour, D = Aller simple Nuit
 */
export function getTariffCode(hour: number, isRoundTrip: boolean): TariffCode {
  const isNight = isNightHour(hour)
  if (isRoundTrip) return isNight ? 'B' : 'A'
  return isNight ? 'D' : 'C'
}

/**
 * Calcule le coût kilométrique d'un trajet avec prorata si traversée de tranche horaire.
 *
 * Exemple : départ à 18h30, durée 45 min → 30 min en Jour + 15 min en Nuit.
 */
function calculateKmCostWithProrata(
  distanceKm: number,
  durationMin: number,
  departureTime: Date,
  isRoundTrip: boolean
): { cost: number; tariffCode: TariffCode } {
  const depHour = departureTime.getHours()
  const depMinute = departureTime.getMinutes()
  const depTotalMin = depHour * 60 + depMinute
  const arrTotalMin = depTotalMin + durationMin

  // Calcule les minutes passées en tranche nuit
  let nightMinutes = 0
  for (let m = 0; m < durationMin; m++) {
    const currentTotalMin = depTotalMin + m
    const currentHour = Math.floor(currentTotalMin / 60) % 24
    if (isNightHour(currentHour)) nightMinutes++
  }
  const dayMinutes = durationMin - nightMinutes

  void arrTotalMin // utilisé implicitement via la boucle

  const dayRate = isRoundTrip ? RATES.A : RATES.C
  const nightRate = isRoundTrip ? RATES.B : RATES.D

  let cost: number
  let tariffCode: TariffCode

  if (durationMin === 0) {
    // Cas limite : trajet instantané → tarif selon heure de départ
    tariffCode = getTariffCode(depHour, isRoundTrip)
    cost = distanceKm * RATES[tariffCode]
  } else if (nightMinutes === 0) {
    tariffCode = isRoundTrip ? 'A' : 'C'
    cost = distanceKm * dayRate
  } else if (dayMinutes === 0) {
    tariffCode = isRoundTrip ? 'B' : 'D'
    cost = distanceKm * nightRate
  } else {
    // Prorata : on répartit la distance proportionnellement à la durée
    const dayRatio = dayMinutes / durationMin
    const nightRatio = nightMinutes / durationMin
    cost = distanceKm * (dayRatio * dayRate + nightRatio * nightRate)
    // Tarif dominant = celui qui couvre le plus de minutes
    tariffCode = dayMinutes >= nightMinutes
      ? (isRoundTrip ? 'A' : 'C')
      : (isRoundTrip ? 'B' : 'D')
  }

  return { cost, tariffCode }
}

// ─── Calcul principal ─────────────────────────────────────────────────────────

export interface CalculateFareParams {
  distanceKm: number
  durationMin: number
  departureTime: Date
  tripType: TripType
  /** Si défini, le forfait est prioritaire sur le calcul kilométrique */
  forfaitPrice?: number
  forfaitName?: string
  /** Réduction promotionnelle en euros (appliquée sur les deux bornes) */
  promotionAmount?: number
}

/**
 * Calcule l'estimation de prix d'une course taxi selon les règles métier Obaid Taxi.
 *
 * Règles :
 * - Forfait gare/aéroport prioritaire si fourni
 * - Prise en charge fixe : 2,94 €
 * - 4 tarifs kilométriques (A/B/C/D) selon heure et type de course
 * - Prorata si traversée tranche jour/nuit
 * - Pour aller-retour : retour calculé à 100% selon heure d'arrivée estimée
 * - Minimum légal : 8 €
 * - Fourchette : de M à M×1.35, arrondie à l'euro supérieur
 */
export function calculateFare(params: CalculateFareParams): PriceEstimate {
  const {
    distanceKm,
    durationMin,
    departureTime,
    tripType,
    forfaitPrice,
    forfaitName,
    promotionAmount = 0,
  } = params

  const isRoundTrip = tripType === 'round_trip'

  // ── Forfait prioritaire — prix fixe, sans marge ──────────────────────────
  if (forfaitPrice !== undefined) {
    const base = Math.max(forfaitPrice, MIN_FARE)
    const fixed = ceilEuro(Math.max(base - promotionAmount, 0))
    return {
      tariff_code: getTariffCode(departureTime.getHours(), isRoundTrip),
      base_price: base,
      estimated_min: fixed,
      estimated_max: fixed,
      distance_km: distanceKm,
      duration_min: durationMin,
      is_forfait: true,
      forfait_name: forfaitName,
    }
  }

  // ── Calcul aller ─────────────────────────────────────────────────────────
  const aller = calculateKmCostWithProrata(
    distanceKm,
    durationMin,
    departureTime,
    isRoundTrip
  )

  let totalKmCost = aller.cost
  let dominantTariff = aller.tariffCode

  // ── Calcul retour (aller-retour uniquement) ───────────────────────────────
  if (isRoundTrip) {
    // Heure d'arrivée estimée = départ + durée de l'aller
    const returnDepartureTime = new Date(departureTime.getTime() + durationMin * 60 * 1000)
    const retour = calculateKmCostWithProrata(
      distanceKm,
      durationMin,
      returnDepartureTime,
      true
    )
    totalKmCost += retour.cost
  }

  // ── Prise en charge + total ───────────────────────────────────────────────
  const rawTotal = BASE_CHARGE + totalKmCost

  // ── Minimum légal ─────────────────────────────────────────────────────────
  const basePrice = Math.max(rawTotal, MIN_FARE)

  // ── Fourchette avec marge et promotion ───────────────────────────────────
  const minEstimate = ceilEuro(Math.max(basePrice - promotionAmount, 0))
  const maxEstimate = ceilEuro(Math.max(basePrice * MARGIN - promotionAmount, 0))

  return {
    tariff_code: dominantTariff,
    base_price: basePrice,
    estimated_min: minEstimate,
    estimated_max: maxEstimate,
    distance_km: distanceKm,
    duration_min: durationMin,
    is_forfait: false,
  }
}

// ─── Points fidélité ──────────────────────────────────────────────────────────

/** 1 point par km estimé (arrondi au km entier) */
export function calculateLoyaltyPoints(distanceKm: number): number {
  return Math.round(distanceKm)
}
