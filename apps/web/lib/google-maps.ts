export interface RouteInfo {
  distance_km: number
  duration_min: number
  polyline: string
}

export async function getRouteInfo(
  origin: string,
  destination: string
): Promise<RouteInfo | null> {
  const params = new URLSearchParams({
    origin,
    destination,
    key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?${params}`
  )
  const data = await res.json()

  if (data.status !== 'OK' || !data.routes[0]) return null

  const leg = data.routes[0].legs[0]
  return {
    distance_km: Math.round((leg.distance.value / 1000) * 10) / 10,
    duration_min: Math.round(leg.duration.value / 60),
    polyline: data.routes[0].overview_polyline.points,
  }
}
