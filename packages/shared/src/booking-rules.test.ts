import { describe, it, expect } from 'vitest'
import { canCancel, isWithin2Hours } from './booking-rules'

const future3h = () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
const future1h = () => new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString()
const past     = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

describe('canCancel()', () => {
  it('autorise l\'annulation pour pending — quel que soit l\'horaire', () => {
    expect(canCancel('pending', past())).toBe(true)
    expect(canCancel('pending', future1h())).toBe(true)
    expect(canCancel('pending', future3h())).toBe(true)
  })

  it('autorise l\'annulation pour confirmed si > 2h avant le départ', () => {
    expect(canCancel('confirmed', future3h())).toBe(true)
  })

  it('bloque l\'annulation pour confirmed si < 2h avant le départ', () => {
    expect(canCancel('confirmed', future1h())).toBe(false)
  })

  it('bloque l\'annulation pour confirmed si le départ est passé', () => {
    expect(canCancel('confirmed', past())).toBe(false)
  })

  it('bloque l\'annulation pour in_progress', () => {
    expect(canCancel('in_progress', future3h())).toBe(false)
  })

  it('bloque l\'annulation pour completed', () => {
    expect(canCancel('completed', future3h())).toBe(false)
  })

  it('bloque l\'annulation pour refused', () => {
    expect(canCancel('refused', future3h())).toBe(false)
  })

  it('bloque l\'annulation pour cancelled', () => {
    expect(canCancel('cancelled', future3h())).toBe(false)
  })

  it('bloque l\'annulation pour no_show', () => {
    expect(canCancel('no_show', future3h())).toBe(false)
  })

  it('bloque l\'annulation pour cancellation_requested', () => {
    expect(canCancel('cancellation_requested', future3h())).toBe(false)
  })
})

describe('isWithin2Hours()', () => {
  it('retourne true si le départ est dans 30 minutes', () => {
    const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    expect(isWithin2Hours(soon)).toBe(true)
  })

  it('retourne true si le départ est dans exactement 2h moins 1 seconde', () => {
    const almostTwo = new Date(Date.now() + 2 * 60 * 60 * 1000 - 1000).toISOString()
    expect(isWithin2Hours(almostTwo)).toBe(true)
  })

  it('retourne false si le départ est dans 3h', () => {
    expect(isWithin2Hours(future3h())).toBe(false)
  })

  it('retourne true pour un départ passé', () => {
    expect(isWithin2Hours(past())).toBe(true)
  })

  it('accepte un objet Date en plus d\'une string ISO', () => {
    const futureDate = new Date(Date.now() + 3 * 60 * 60 * 1000)
    expect(isWithin2Hours(futureDate)).toBe(false)
  })
})
