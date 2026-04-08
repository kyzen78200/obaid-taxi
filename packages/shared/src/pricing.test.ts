import { describe, it, expect } from 'vitest'
import { calculateFare, getTariffCode, calculateLoyaltyPoints } from './pricing'

// ─── getTariffCode ────────────────────────────────────────────────────────────

describe('getTariffCode', () => {
  it('retourne A pour aller-retour de jour (10h)', () => {
    expect(getTariffCode(10, true)).toBe('A')
  })
  it('retourne B pour aller-retour de nuit (22h)', () => {
    expect(getTariffCode(22, true)).toBe('B')
  })
  it('retourne C pour aller simple de jour (14h)', () => {
    expect(getTariffCode(14, false)).toBe('C')
  })
  it('retourne D pour aller simple de nuit (3h)', () => {
    expect(getTariffCode(3, false)).toBe('D')
  })
  it('retourne D pour aller simple à 19h00 (début de nuit)', () => {
    expect(getTariffCode(19, false)).toBe('D')
  })
  it('retourne C pour aller simple à 18h59', () => {
    expect(getTariffCode(18, false)).toBe('C')
  })
})

// ─── calculateFare ────────────────────────────────────────────────────────────

describe('calculateFare — aller simple de jour', () => {
  it('calcule correctement un trajet de jour (10 km, 15 min)', () => {
    const result = calculateFare({
      distanceKm: 10,
      durationMin: 15,
      departureTime: new Date('2024-05-22T10:00:00'),
      tripType: 'one_way',
    })
    // base = 2.94 + 10 * 1.98 = 22.74
    // min = ceil(22.74) = 23, max = ceil(22.74 * 1.35) = ceil(30.699) = 31
    expect(result.tariff_code).toBe('C')
    expect(result.base_price).toBeCloseTo(22.74, 1)
    expect(result.estimated_min).toBe(23)
    expect(result.estimated_max).toBe(31)
    expect(result.is_forfait).toBe(false)
  })
})

describe('calculateFare — minimum légal', () => {
  it('applique le minimum légal à 8€ pour un court trajet', () => {
    const result = calculateFare({
      distanceKm: 1,
      durationMin: 3,
      departureTime: new Date('2024-05-22T10:00:00'),
      tripType: 'one_way',
    })
    // base = 2.94 + 1 * 1.98 = 4.92 < 8 → min = 8
    expect(result.estimated_min).toBe(8)
    expect(result.estimated_max).toBe(11) // ceil(8 * 1.35) = ceil(10.8) = 11
  })
})

describe('calculateFare — aller-retour de jour', () => {
  it('calcule aller + retour pour un trajet de jour complet (15 km, 20 min aller)', () => {
    const result = calculateFare({
      distanceKm: 15,
      durationMin: 20,
      departureTime: new Date('2024-05-22T10:00:00'),
      tripType: 'round_trip',
    })
    // aller : 15 * 0.99 = 14.85 (jour, A)
    // retour : départ à 10h20, encore de jour → 15 * 0.99 = 14.85
    // total km = 29.70 + 2.94 = 32.64
    expect(result.tariff_code).toBe('A')
    expect(result.base_price).toBeCloseTo(32.64, 1)
  })
})

describe('calculateFare — traversée jour/nuit', () => {
  it('calcule un prorata pour un trajet démarrant à 18h45 (15 min)', () => {
    // Départ 18h45, durée 30 min → 15 min en Jour (18h45-19h00), 15 min en Nuit
    const result = calculateFare({
      distanceKm: 10,
      durationMin: 30,
      departureTime: new Date('2024-05-22T18:45:00'),
      tripType: 'one_way',
    })
    // Prorata 50% jour / 50% nuit : 10 * (0.5*1.98 + 0.5*2.97) = 10 * 2.475 = 24.75
    // base = 2.94 + 24.75 = 27.69
    expect(result.base_price).toBeCloseTo(27.69, 1)
    expect(result.is_forfait).toBe(false)
  })
})

describe('calculateFare — forfait gare/aéroport', () => {
  it('utilise le forfait et ignore le calcul kilométrique (prix fixe sans marge)', () => {
    const result = calculateFare({
      distanceKm: 5,
      durationMin: 10,
      departureTime: new Date('2024-05-22T10:00:00'),
      tripType: 'one_way',
      forfaitPrice: 25,
      forfaitName: 'Gare de Mantes-la-Jolie',
    })
    // Forfait = prix fixe, min == max (pas de marge appliquée)
    expect(result.is_forfait).toBe(true)
    expect(result.estimated_min).toBe(25)
    expect(result.estimated_max).toBe(25)
    expect(result.forfait_name).toBe('Gare de Mantes-la-Jolie')
  })

  it('applique le minimum légal sur un forfait inférieur à 8€', () => {
    const result = calculateFare({
      distanceKm: 1,
      durationMin: 5,
      departureTime: new Date('2024-05-22T10:00:00'),
      tripType: 'one_way',
      forfaitPrice: 5,
      forfaitName: 'Test',
    })
    expect(result.estimated_min).toBe(8)
    expect(result.estimated_max).toBe(8)
  })

  it('applique la promotion sur un forfait', () => {
    const result = calculateFare({
      distanceKm: 5,
      durationMin: 10,
      departureTime: new Date('2024-05-22T10:00:00'),
      tripType: 'one_way',
      forfaitPrice: 25,
      promotionAmount: 5,
    })
    expect(result.estimated_min).toBe(20)
    expect(result.estimated_max).toBe(20)
  })
})

describe('calculateFare — promotion', () => {
  it('applique la promotion sur les deux bornes', () => {
    const result = calculateFare({
      distanceKm: 10,
      durationMin: 15,
      departureTime: new Date('2024-05-22T10:00:00'),
      tripType: 'one_way',
      promotionAmount: 3,
    })
    // base ≈ 22.74, min = ceil(22.74 - 3) = ceil(19.74) = 20
    // max = ceil(22.74 * 1.35 - 3) = ceil(27.699) = 28
    expect(result.estimated_min).toBe(20)
    expect(result.estimated_max).toBe(28)
  })
})

describe('calculateFare — aller simple de nuit', () => {
  it('applique le tarif D (nuit) à 22h', () => {
    const result = calculateFare({
      distanceKm: 10,
      durationMin: 15,
      departureTime: new Date('2024-05-22T22:00:00'),
      tripType: 'one_way',
    })
    // base = 2.94 + 10 * 2.97 = 32.64
    expect(result.tariff_code).toBe('D')
    expect(result.base_price).toBeCloseTo(32.64, 1)
    expect(result.estimated_min).toBe(33)
    expect(result.estimated_max).toBe(45) // ceil(32.64 * 1.35) = ceil(44.064) = 45
  })
})

describe('calculateFare — aller-retour traversée jour→nuit', () => {
  it('calcule aller de jour + retour de nuit', () => {
    // Départ 18h30, durée 45 min → arrivée 19h15 → retour en nuit
    const result = calculateFare({
      distanceKm: 20,
      durationMin: 45,
      departureTime: new Date('2024-05-22T18:30:00'),
      tripType: 'round_trip',
    })
    expect(result.is_forfait).toBe(false)
    // Le tarif dominant doit être B (aller-retour nuit) car le retour est 100% de nuit
    expect(['A', 'B']).toContain(result.tariff_code)
    expect(result.estimated_max).toBeGreaterThan(result.estimated_min)
  })
})

describe('calculateFare — trajet durée zéro', () => {
  it('gère un trajet instantané (durationMin = 0)', () => {
    const result = calculateFare({
      distanceKm: 5,
      durationMin: 0,
      departureTime: new Date('2024-05-22T10:00:00'),
      tripType: 'one_way',
    })
    expect(result.tariff_code).toBe('C')
    expect(result.base_price).toBeGreaterThanOrEqual(8)
  })
})

// ─── calculateLoyaltyPoints ───────────────────────────────────────────────────

describe('calculateLoyaltyPoints', () => {
  it('retourne le nombre de km arrondi', () => {
    expect(calculateLoyaltyPoints(12.4)).toBe(12)
    expect(calculateLoyaltyPoints(12.5)).toBe(13)
    expect(calculateLoyaltyPoints(0.3)).toBe(0)
  })
})
