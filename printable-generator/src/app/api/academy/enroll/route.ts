import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { courseId } = await req.json();
    if (!courseId) {
      return NextResponse.json({ error: "courseId required" }, { status: 400 });
    }

    const [user, course, existing] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, name: true, stripeCustomerId: true } }),
      prisma.course.findUnique({ where: { id: courseId }, select: { id: true, slug: true, title: true, price: true, currency: true } }),
      prisma.enrollment.findUnique({ where: { userId_courseId: { userId: session.user.id, courseId } } }),
    ]);

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    if (existing) return NextResponse.json({ error: "Already enrolled", enrolled: true }, { status: 409 });

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{
        price_data: {
          currency: course.currency.toLowerCase(),
          product_data: { name: `Noor Academy: ${course.title}`, description: "Lifetime access to this course" },
          unit_amount: Math.round(course.price * 100),
        },
        quantity: 1,
      }],
      success_url: `${appUrl}/academy/learn/${course.slug}?enrolled=true`,
      cancel_url: `${appUrl}/academy/${course.slug}`,
      allow_promotion_codes: true,
      metadata: { userId: user.id, courseId: course.id, type: "course_purchase", courseSlug: course.slug },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Enroll error:", error);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
