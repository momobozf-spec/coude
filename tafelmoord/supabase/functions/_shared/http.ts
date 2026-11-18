// Gedeelde helpers voor de edge functions (Deno).

// Tafelmoord deelt een Supabase-project met andere shops. Eigen instellingen staan daarom
// onder TM_<NAAM>. Alleen echt gedeelde sleutels mogen terugvallen op de gewone naam.
const SHARED = new Set(["STRIPE_SECRET_KEY", "RESEND_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

export function env(name: string, required = true): string {
  const own = Deno.env.get(`TM_${name}`) ?? "";
  const v = own || (SHARED.has(name) ? Deno.env.get(name) ?? "" : "");
  if (required && !v) throw new Error(`Omgevingsvariabele TM_${name} ontbreekt`);
  return v;
}

export function corsHeaders(_origin: string | null): Record<string, string> {
  // Alleen de eigen site mag de functies vanuit de browser aanroepen.
  return {
    "Access-Control-Allow-Origin": env("SITE_URL"),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Vary": "Origin",
  };
}

export function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export async function stripe(path: string, init: { method?: string; body?: string } = {}): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: init.body,
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? `Stripe-fout ${res.status}`;
    throw new Error(msg);
  }
  return data;
}
