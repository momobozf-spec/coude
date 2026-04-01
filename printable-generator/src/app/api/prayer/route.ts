import { NextRequest, NextResponse } from "next/server";
import { calculatePrayerTimes, calculateQibla, distanceToMecca, getNextPrayer, MethodKey, METHODS } from "@/lib/prayer";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get("lat") || "0");
  const lng = parseFloat(url.searchParams.get("lng") || "0");
  const method = (url.searchParams.get("method") || "MWL") as MethodKey;

  if (!lat && !lng) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const times = calculatePrayerTimes(lat, lng, new Date(), method);
  const qibla = calculateQibla(lat, lng);
  const distance = distanceToMecca(lat, lng);
  const next = getNextPrayer(times);

  return NextResponse.json({
    times,
    qibla: Math.round(qibla * 10) / 10,
    distanceToMecca: Math.round(distance),
    nextPrayer: next,
    method: METHODS[method].name,
    date: new Date().toISOString().slice(0, 10),
  });
}
