import Constants from 'expo-constants'

const GOOGLE_MAPS_API_KEY =
  Constants.expoConfig?.extra?.googleMapsApiKey
  ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY!

export interface RouteInfo {
  distance_km: number
  duration_min: number
  encoded_polyline: string
}

/**
 * Récupère la distance (km), la durée estimée (min) et le tracé encodé
 * entre deux points via l'API Google Directions.
 *
 * @param origin - Coordonnées du point de départ
 * @param destination - Coordonnées du point d'arrivée
 * @returns Infos de trajet incluant la polyline encodée pour l'affichage sur carte
 * @throws Error si la requête HTTP échoue ou si Google Directions retourne un status != 'OK'
 *         (ex : ZERO_RESULTS si les deux points sont inaccessibles, REQUEST_DENIED si la clé est invalide)
 */
export async function getRouteInfo(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<RouteInfo> {
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
  url.searchParams.set('origin', `${origin.lat},${origin.lng}`)
  url.searchParams.set('destination', `${destination.lat},${destination.lng}`)
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY)
  url.searchParams.set('language', 'fr')
  url.searchParams.set('region', 'fr')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Erreur lors du calcul de l\'itinéraire')

  const data = await res.json()

  if (data.status !== 'OK' || !data.routes.length) {
    throw new Error('Impossible de calculer l\'itinéraire')
  }

  const route = data.routes[0]
  const leg = route.legs[0]

  return {
    distance_km: leg.distance.value / 1000,
    duration_min: Math.ceil(leg.duration.value / 60),
    encoded_polyline: route.overview_polyline.points,
  }
}

export { GOOGLE_MAPS_API_KEY }
