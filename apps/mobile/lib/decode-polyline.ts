/** Décode un polyline encodé Google Maps en tableau de coordonnées */
export function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const result: { latitude: number; longitude: number }[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let b: number
    let shift = 0
    let val = 0
    do { b = encoded.charCodeAt(index++) - 63; val |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += val & 1 ? ~(val >> 1) : val >> 1

    shift = 0; val = 0
    do { b = encoded.charCodeAt(index++) - 63; val |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += val & 1 ? ~(val >> 1) : val >> 1

    result.push({ latitude: lat / 1e5, longitude: lng / 1e5 })
  }
  return result
}
