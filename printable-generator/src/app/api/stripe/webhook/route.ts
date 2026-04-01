// Backward-compat: forward to the canonical webhook path at /api/webhooks/stripe
// Configure your Stripe Dashboard webhook to point to /api/webhooks/stripe instead.
export { POST } from "@/app/api/webhooks/stripe/route";
