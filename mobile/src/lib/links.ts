/** Google Maps directions from the search origin to a hospital; opens the Maps app on a phone. */
export const routeLink = (from: { lat: number; lng: number }, to: { lat: number; lng: number }): string =>
  `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
