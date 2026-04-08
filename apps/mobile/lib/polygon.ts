/**
 * Algorithme ray-casting : retourne true si le point est dans le polygone.
 * polygon : tableau de [lng, lat] (format GeoJSON)
 * point   : { lat, lng }
 */
export function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: [number, number][]
): boolean {
  const { lat, lng } = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1]
    const xj = polygon[j][0], yj = polygon[j][1]
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// Zone Mantes-la-Jolie — coordonnées GeoJSON [lng, lat]
export const MANTES_POLYGON: [number, number][] = [
  [1.679371710738983,  49.00415094708245],
  [1.6478899729894514, 48.97388394305605],
  [1.6940143794596954, 48.94480070338896],
  [1.7463619201362417, 48.93566362474602],
  [1.8730210045704037, 48.94431984621403],
  [1.8649675367740122, 48.99190223172656],
  [1.793950593478557,  48.96547317888132],
  [1.7628349224470434, 48.96643448088174],
  [1.7496565205984025, 48.96859734262679],
  [1.7394066524939036, 48.97412422975638],
  [1.707924914744372,  49.00823318286316],
  [1.690719778997535,  49.01543631198302],
  [1.679371710738983,  49.00415094708245],
]
