export interface RouteInfo {
  distance_km: number
  duration_min: number
  polyline: string
}

export async function getRouteInfo(
  origin: string,
  destination: string
): Promise<RouteInfo | null> {
  const params = new URLSearchParams({ origin, destination })
  const res = await fetch(`/api/route-info?${params}`)
  if (!res.ok) return null
  return res.json()
}
