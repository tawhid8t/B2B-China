export type CainiaoOcrCandidate = {
  trackingNumber: string;
  pickupCode: string;
  carrier: string;
  pickupStation: string;
  status: "ready_for_pickup" | "arriving_soon" | "in_transit" | "returned";
  confidence: "low" | "medium" | "high";
};

const carrierNames = [
  ["中通", "ZTO"], ["申通", "STO"], ["圆通", "YTO"], ["韵达", "Yunda"],
  ["极兔", "J&T"], ["顺丰", "SF Express"], ["邮政", "China Post"],
] as const;

export function extractCainiaoCandidates(ocrText: string): CainiaoOcrCandidate[] {
  const text = ocrText.replace(/\r/g, "").replace(/[－—–]/g, "-");
  const pickupCodes = [...text.matchAll(/(?<!\d)(\d{1,4}\s*-\s*\d{1,3}\s*-\s*\d{3,6})(?!\d)/g)]
    .map((match) => ({ value: match[1].replace(/\s+/g, ""), index: match.index ?? 0 }));
  const trackingNumbers = [...text.toUpperCase().matchAll(/(?<![A-Z0-9-])([A-Z0-9-]{8,32})(?![A-Z0-9-])/g)]
    .map((match) => ({ value: match[1], index: match.index ?? 0 }))
    .filter((candidate) => /\d/.test(candidate.value) && !/^\d{1,4}-\d{1,3}-\d{3,6}$/.test(candidate.value));
  const carrier = carrierNames.find(([needle]) => text.includes(needle))?.[1] ?? "";
  const status: CainiaoOcrCandidate["status"] = /退回|退件|拒收|已退/.test(text)
    ? "returned"
    : /待取件|已到驿站|已入库|取件码/.test(text)
      ? "ready_for_pickup"
      : /即将|预计|派送中|到站/.test(text)
        ? "arriving_soon"
        : "in_transit";
  const pickupStation = text.match(/(?:驿站|取件点|站点)[：:\s]*([^\n]{2,48})/)?.[1]?.trim() ?? "";
  const usedPickupCodes = new Set<number>();
  return trackingNumbers.map((tracking) => {
    const nearest = pickupCodes.map((pickup, index) => ({ pickup, index, distance: Math.abs(pickup.index - tracking.index) }))
      .filter(({ index }) => !usedPickupCodes.has(index)).sort((a, b) => a.distance - b.distance)[0];
    if (nearest && nearest.distance < 260) usedPickupCodes.add(nearest.index);
    const pickupCode = nearest && nearest.distance < 260 ? nearest.pickup.value : "";
    const filledFields = [tracking.value, pickupCode, carrier, pickupStation].filter(Boolean).length;
    const confidence: CainiaoOcrCandidate["confidence"] = filledFields >= 3 ? "high" : filledFields === 2 ? "medium" : "low";
    return { trackingNumber: tracking.value, pickupCode, carrier, pickupStation, status, confidence };
  }).filter((candidate, index, candidates) => candidates.findIndex((other) => other.trackingNumber === candidate.trackingNumber) === index);
}
