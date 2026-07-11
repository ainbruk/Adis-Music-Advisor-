// Popularität (0–100) grob in Streams übersetzen (logarithmische Skala:
// 0 ≈ unter 1'000, 100 ≈ über 1 Milliarde)
export function streamsLabel(pop: number): string {
  const streams = Math.pow(10, 3 + (pop / 100) * 6);
  if (streams >= 1e9) return "über 1 Mrd. Streams";
  if (streams >= 1e6) return `≈ ${Math.round(streams / 1e6)} Mio. Streams`;
  return `≈ ${Math.round(streams / 1e3)}'000 Streams`;
}
