import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel
    const [
      totalUsers,
      freeUsers,
      proUsers,
      schoolUsers,
      signupsToday,
      signupsWeek,
      signupsMonth,
      totalGenerations,
      generationsToday,
      generationsWeek,
      totalLeads,
      leadsWeek,
      topReferrers,
      topThemes,
      recentSignups,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { plan: "free" } }),
      prisma.user.count({ where: { plan: "pro" } }),
      prisma.user.count({ where: { plan: "school" } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.generation.count(),
      prisma.generation.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.generation.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.lead.count(),
      prisma.lead.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.findMany({
        where: { referralCount: { gt: 0 } },
        orderBy: { referralCount: "desc" },
        take: 10,
        select: { name: true, email: true, referralCount: true, bonusGenerations: true },
      }),
      prisma.generation.groupBy({
        by: ["theme"],
        _count: { theme: true },
        orderBy: { _count: { theme: "desc" } },
        take: 10,
      }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { name: true, email: true, plan: true, createdAt: true, referredBy: true },
      }),
    ]);

    // MRR calculation (estimated)
    const mrr = proUsers * 12 + schoolUsers * 49;
    const mrrYearlyEstimate = mrr * 12;

    // Conversion funnel
    const usersWhoGenerated = await prisma.user.count({
      where: { generationsCount: { gt: 0 } },
    });
    const conversionRate = totalUsers > 0 ? ((proUsers + schoolUsers) / totalUsers * 100).toFixed(1) : "0";
    const activationRate = totalUsers > 0 ? (usersWhoGenerated / totalUsers * 100).toFixed(1) : "0";

    return NextResponse.json({
      overview: {
        totalUsers,
        signupsToday,
        signupsWeek,
        signupsMonth,
        mrr,
        mrrYearlyEstimate,
      },
      plans: {
        free: freeUsers,
        pro: proUsers,
        school: schoolUsers,
      },
      generations: {
        total: totalGenerations,
        today: generationsToday,
        week: generationsWeek,
      },
      leads: {
        total: totalLeads,
        week: leadsWeek,
      },
      funnel: {
        totalSignups: totalUsers,
        activated: usersWhoGenerated,
        activationRate: `${activationRate}%`,
        paid: proUsers + schoolUsers,
        conversionRate: `${conversionRate}%`,
      },
      topReferrers,
      topThemes: topThemes.map(t => ({
        theme: t.theme,
        count: t._count.theme,
      })),
      recentSignups,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
