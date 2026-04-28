import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const origin = searchParams.get('origin')
  const destination = searchParams.get('destination')

  if (!origin || !destination) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const params = new URLSearchParams({
    origin,
    destination,
    key: process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?${params}`
  )
  const data = await res.json()

  if (data.status !== 'OK' || !data.routes?.[0]) {
    return NextResponse.json({ error: data.status }, { status: 400 })
  }

  const leg = data.routes[0].legs[0]
  return NextResponse.json({
    distance_km: Math.round((leg.distance.value / 1000) * 10) / 10,
    duration_min: Math.round(leg.duration.value / 60),
    polyline: data.routes[0].overview_polyline.points,
  })
}
