// Analytics event tracking - swap implementation for your provider
// Supports: Google Analytics, Mixpanel, PostHog, Amplitude, etc.

type EventName =
  | "page_view"
  | "sign_up"
  | "login"
  | "generate_pdf"
  | "download_pdf"
  | "color_start"
  | "color_save"
  | "upgrade_click"
  | "checkout_start"
  | "checkout_complete"
  | "referral_share"
  | "referral_signup"
  | "lead_captured"
  | "pricing_view"
  | "limit_reached"
  | "community_joined"
  | "community_visited"
  | "community_posted"
  | "community_event_attended";

interface EventProps {
  [key: string]: string | number | boolean | undefined;
}

export function trackEvent(name: EventName, props?: EventProps) {
  // Google Analytics 4
  if (typeof window !== "undefined" && "gtag" in window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as unknown as Record<string, any>).gtag("event", name, props);
  }

  // Console in development
  if (process.env.NODE_ENV === "development") {
    console.log(`[Analytics] ${name}`, props);
  }
}
