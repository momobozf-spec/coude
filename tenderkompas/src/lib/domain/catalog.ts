/**
 * Gecontroleerde lijst van diensten met CPV-codes en NL/FR/EN-zoektermen.
 * Gebruikt voor (1) de TED-zoekopdracht en (2) de uitlegbare relevantiebeoordeling.
 * CPV-codes volgens CPV 2008; te herbevestigen bij wijziging van de woordenlijst.
 */
export type ServiceKey = "cloud_azure" | "fabric_powerbi" | "databricks_engineering" | "dwh_analytics_governance";

export const SERVICE_CATALOG: Record<
  ServiceKey,
  { label: string; cpvPrefixes: string[]; terms: { nl: string[]; fr: string[]; en: string[] } }
> = {
  cloud_azure: {
    label: "Azure en cloudimplementaties",
    cpvPrefixes: ["72222300", "72227000", "72260000", "72263000", "72266000", "72600000", "72500000"],
    terms: {
      nl: ["azure", "cloudmigratie", "migratie naar de cloud", "cloudplatform", "cloud-omgeving", "cloudomgeving"],
      fr: ["azure", "migration vers le cloud", "plateforme cloud", "infonuagique", "services cloud"],
      en: ["azure", "cloud migration", "cloud platform", "cloud services", "landing zone"],
    },
  },
  fabric_powerbi: {
    label: "Microsoft Fabric en Power BI",
    cpvPrefixes: ["48482000", "72316000", "72322000"],
    terms: {
      nl: ["power bi", "microsoft fabric", "rapportering", "dashboards", "business intelligence"],
      fr: ["power bi", "microsoft fabric", "rapportage", "tableaux de bord", "informatique décisionnelle"],
      en: ["power bi", "microsoft fabric", "reporting", "dashboards", "business intelligence"],
    },
  },
  databricks_engineering: {
    label: "Databricks en data-engineering",
    cpvPrefixes: ["72300000", "72310000", "72320000", "72322000"],
    terms: {
      nl: ["databricks", "data-engineering", "data engineering", "dataplatform", "datapijplijn", "lakehouse", "etl"],
      fr: ["databricks", "ingénierie des données", "plateforme de données", "pipeline de données", "lakehouse", "etl"],
      en: ["databricks", "data engineering", "data platform", "data pipeline", "lakehouse", "etl", "spark"],
    },
  },
  dwh_analytics_governance: {
    label: "Datawarehousing, analytics en datagovernance",
    cpvPrefixes: ["72316000", "72320000", "48610000", "72221000"],
    terms: {
      nl: ["datawarehouse", "data warehouse", "analytics", "data-analyse", "datagovernance", "datakwaliteit", "masterdata"],
      fr: ["entrepôt de données", "datawarehouse", "analyse de données", "gouvernance des données", "qualité des données"],
      en: ["data warehouse", "analytics", "data governance", "data quality", "master data", "data catalog"],
    },
  },
};

/** Brede CPV-filters voor de TED-zoekopdracht (lokaal verder verfijnd). */
export const TED_CPV_QUERY_PREFIXES = ["72", "48"];

export const ALL_TERMS: string[] = Array.from(
  new Set(
    Object.values(SERVICE_CATALOG).flatMap((s) => [...s.terms.nl, ...s.terms.fr, ...s.terms.en]),
  ),
);

/** Termen die specifiek genoeg zijn voor een full-text TED-zoekopdracht. */
export const TED_FULLTEXT_TERMS = [
  "Power BI",
  "Microsoft Fabric",
  "Databricks",
  "Azure",
  "datawarehouse",
  "data warehouse",
  "entrepôt de données",
  "dataplatform",
  "plateforme de données",
  "data platform",
  "business intelligence",
  "datagovernance",
  "gouvernance des données",
  "data governance",
];

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

export function containsTerm(haystack: string, term: string): boolean {
  const h = ` ${normalize(haystack)} `;
  const t = normalize(term).trim();
  if (!t) return false;
  // Woordgrens: vermijd "bi" in "mobiliteit"
  const re = new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
  return re.test(h);
}

export function cpvMatches(cpvCodes: string[], prefixes: string[]): string[] {
  return cpvCodes.filter((c) => prefixes.some((p) => c.replace(/-.*/, "").startsWith(p.replace(/0+$/, ""))));
}

/** Snelle pre-filter: is een aankondiging potentieel relevant voor de doelgroep? */
export function isPotentiallyRelevant(input: { cpvCodes: string[]; text: string }): {
  relevant: boolean;
  matchedServices: ServiceKey[];
  reasons: string[];
} {
  const matched: ServiceKey[] = [];
  const reasons: string[] = [];
  for (const [key, svc] of Object.entries(SERVICE_CATALOG) as [ServiceKey, (typeof SERVICE_CATALOG)[ServiceKey]][]) {
    const cpv = cpvMatches(input.cpvCodes, svc.cpvPrefixes);
    const terms = [...svc.terms.nl, ...svc.terms.fr, ...svc.terms.en].filter((t) => containsTerm(input.text, t));
    if (cpv.length || terms.length) {
      matched.push(key);
      if (cpv.length) reasons.push(`${svc.label}: CPV ${cpv.join(", ")}`);
      if (terms.length) reasons.push(`${svc.label}: termen ${Array.from(new Set(terms)).join(", ")}`);
    }
  }
  return { relevant: matched.length > 0, matchedServices: matched, reasons };
}
