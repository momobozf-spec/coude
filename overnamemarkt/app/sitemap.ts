import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = ["", "/verkopen", "/hoe-het-werkt", "/voorwaarden", "/privacy"].map((p) => ({ url: `${site.url}${p}` }));
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("listings").select("id,updated_at").in("status", ["published", "under_offer"]).limit(1000);
    return base.concat((data ?? []).map((l) => ({ url: `${site.url}/aanbod/${l.id}`, lastModified: l.updated_at })));
  } catch {
    return base;
  }
}
