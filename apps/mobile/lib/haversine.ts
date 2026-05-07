const EARTH_RADIUS_KM = 6371

/**
 * Calcule la distance à vol d'oiseau entre deux points GPS (formule Haversine).
 * Utilisée pour détecter si un point de départ ou d'arrivée est dans une zone forfait.
 *
 * @param a - Point d'origine avec latitude et longitude en degrés décimaux
 * @param b - Point de destination avec latitude et longitude en degrés décimaux
 * @returns Distance en kilomètres
 */
export function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}
