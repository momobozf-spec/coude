import { NextRequest, NextResponse } from "next/server";
import { calculatePrayerTimes, MethodKey } from "@/lib/prayer";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get("lat") || "0");
  const lng = parseFloat(url.searchParams.get("lng") || "0");
  const method = (url.searchParams.get("method") || "MWL") as MethodKey;
  const days = Math.min(parseInt(url.searchParams.get("days") || "30"), 90);
  const location = url.searchParams.get("location") || "My Location";

  if (!lat && !lng) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const prayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const prayerKeys = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
  const alarmMinutes = [15, 15, 15, 5, 15]; // reminder minutes before

  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Noor Printables//Prayer Times//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Prayer Times — ${location}`,
    "X-WR-TIMEZONE:Europe/Amsterdam",
  ];

  const today = new Date();

  for (let d = 0; d < days; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() + d);

    const times = calculatePrayerTimes(lat, lng, date, method);
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");

    for (let i = 0; i < prayers.length; i++) {
      const timeStr = times[prayerKeys[i]];
      const [h, m] = timeStr.split(":").map(Number);
      const startDt = `${dateStr}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
      // Prayer duration: 15 minutes
      const endH = h + (m + 15 >= 60 ? 1 : 0);
      const endM = (m + 15) % 60;
      const endDt = `${dateStr}T${String(endH).padStart(2, "0")}${String(endM).padStart(2, "0")}00`;

      const uid = `noor-prayer-${dateStr}-${prayerKeys[i]}@noorprintables.com`;

      ics.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTART:${startDt}`,
        `DTEND:${endDt}`,
        `SUMMARY:${prayers[i]} Prayer 🕌`,
        `DESCRIPTION:${prayers[i]} prayer time at ${timeStr}\\nCalculated by Noor Printables`,
        `LOCATION:${location}`,
        "STATUS:CONFIRMED",
        `CATEGORIES:Prayer`,
        // Alarm/reminder
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${prayers[i]} prayer in ${alarmMinutes[i]} minutes`,
        `TRIGGER:-PT${alarmMinutes[i]}M`,
        "END:VALARM",
        "END:VEVENT"
      );
    }
  }

  ics.push("END:VCALENDAR");

  const icsContent = ics.join("\r\n");

  return new NextResponse(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="prayer-times-${location.replace(/\s+/g, "-").toLowerCase()}.ics"`,
    },
  });
}
