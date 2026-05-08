import { describe, it, expect } from 'vitest'
import { haversineDistance } from './haversine'

describe('haversineDistance()', () => {
  it('retourne 0 pour deux points identiques', () => {
    const p = { lat: 48.990, lng: 1.717 }
    expect(haversineDistance(p, p)).toBe(0)
  })

  it('calcule ~111km pour 1 degré de latitude', () => {
    const a = { lat: 48.0, lng: 0.0 }
    const b = { lat: 49.0, lng: 0.0 }
    const dist = haversineDistance(a, b)
    expect(dist).toBeGreaterThan(110)
    expect(dist).toBeLessThan(112)
  })

  it('est symétrique : dist(A,B) === dist(B,A)', () => {
    const a = { lat: 48.990, lng: 1.717 } // Mantes-la-Jolie
    const b = { lat: 48.866, lng: 2.333 } // Paris
    expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 5)
  })

  it('calcule ~50km entre Mantes-la-Jolie et Paris', () => {
    const mantes = { lat: 48.990, lng: 1.717 }
    const paris  = { lat: 48.866, lng: 2.333 }
    const dist = haversineDistance(mantes, paris)
    expect(dist).toBeGreaterThan(45)
    expect(dist).toBeLessThan(55)
  })

  it('retourne une valeur positive pour deux points distincts', () => {
    const a = { lat: 0, lng: 0 }
    const b = { lat: 10, lng: 10 }
    expect(haversineDistance(a, b)).toBeGreaterThan(0)
  })
})
