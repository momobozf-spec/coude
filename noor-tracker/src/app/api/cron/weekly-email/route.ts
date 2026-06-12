import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendWeeklySummaryEmail } from "@/lib/email";
import { getHabitsForPlan } from "@/lib/habits";
import { getDayName } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret for security
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET ontbreekt." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all Pro users with children
  const proUsers = await prisma.user.findMany({
    where: { plan: "pro" },
    include: {
      children: {
        include: {
          logs: {
            where: {
              date: {
                gte: getLastSunday(),
              },
            },
            orderBy: { date: "asc" },
          },
        },
      },
    },
  });

  let emailsSent = 0;

  for (const user of proUsers) {
    for (const child of user.children) {
      const habits = getHabitsForPlan("pro");
      const last7Days = getLast7DaysFromSunday();

      const dailySummaries = last7Days.map((date) => {
        const log = child.logs.find((l) => l.date === date);
        return {
          date,
          dayName: getDayName(date),
          stars: log?.stars ?? 0,
          total: habits.length,
        };
      });

      const totalStars = dailySummaries.reduce((sum, d) => sum + d.stars, 0);

      if (totalStars > 0) {
        try {
          await sendWeeklySummaryEmail({
            childName: child.name,
            parentEmail: user.email,
            totalStars,
            dailySummaries,
          });
          emailsSent++;
        } catch (err) {
          console.error(`Failed to send email for ${child.name}:`, err);
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    emailsSent,
    usersProcessed: proUsers.length,
  });
}

function getLastSunday(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - dayOfWeek - 7);
  return lastSunday.toISOString().split("T")[0];
}

function getLast7DaysFromSunday(): string[] {
  const dates: string[] = [];
  const now = new Date();
  const dayOfWeek = now.getDay();

  for (let i = 7; i >= 1; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - dayOfWeek - i + 7);
    dates.push(date.toISOString().split("T")[0]);
  }

  return dates;
}
