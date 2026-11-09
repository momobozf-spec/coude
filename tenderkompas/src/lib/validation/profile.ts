import { z } from "zod";

const tri = z.enum(["yes", "no", "unknown"]);
const csv = z
  .string()
  .optional()
  .transform((s) =>
    (s ?? "")
      .split(/[,;\n]/)
      .map((x) => x.trim())
      .filter(Boolean),
  );
const optNumber = z
  .string()
  .optional()
  .transform((s, ctx) => {
    const t = (s ?? "").trim().replace(/\s/g, "").replace(",", ".");
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Ongeldig getal" });
      return z.NEVER;
    }
    return n;
  });

export const referenceSchema = z.object({
  id: z.string().min(1),
  holder: z.enum(["company", "individual"]),
  title: z.string().trim().min(2).max(200),
  clientName: z.string().trim().max(200).nullable().optional(),
  year: z.number().int().min(1990).max(2100).nullable().optional(),
  valueEur: z.number().min(0).nullable().optional(),
  publicSector: tri,
  technologies: z.array(z.string().trim().max(60)).max(30),
  description: z.string().trim().max(2000).nullable().optional(),
});

export const certificationSchema = z.object({
  id: z.string().min(1),
  holder: z.enum(["company", "individual"]),
  name: z.string().trim().min(2).max(120),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const profileFormSchema = z
  .object({
    companyName: z.string().trim().min(2).max(200),
    website: z
      .string()
      .trim()
      .max(300)
      .optional()
      .transform((s) => s || null)
      .refine((s) => !s || /^https?:\/\//i.test(s), "Website moet met http(s):// beginnen"),
    contactName: z.string().trim().max(200).optional().transform((s) => s || null),
    contactEmail: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((s) => s || null)
      .refine((s) => !s || z.email().safeParse(s).success, "Ongeldig e-mailadres"),
    services: z.array(z.enum(["cloud_azure", "fabric_powerbi", "databricks_engineering", "dwh_analytics_governance"])),
    expertise: z.string().trim().max(4000).optional().transform((s) => s || null),
    technologies: csv,
    excludedWork: csv,
    languages: z.array(z.enum(["nl", "fr", "en", "de"])),
    regions: z.array(z.string().regex(/^(BE|BE[1-3]\d?|REMOTE)$/i)),
    teamSize: optNumber.transform((n) => (n === null ? null : Math.round(n))),
    availableCapacityFte: optNumber,
    contractValueMinEur: optNumber,
    contractValueMaxEur: optNumber,
    publicSectorExperience: tri,
    openToConsortium: tri,
    openToSubcontracting: tri,
    annualRevenueEur: optNumber,
    references: z.array(referenceSchema).max(50),
    certifications: z.array(certificationSchema).max(50),
  })
  .refine(
    (v) => v.contractValueMinEur === null || v.contractValueMaxEur === null || v.contractValueMinEur <= v.contractValueMaxEur,
    { message: "Minimumomvang mag niet groter zijn dan maximumomvang", path: ["contractValueMaxEur"] },
  );

export type ProfileForm = z.infer<typeof profileFormSchema>;

export const REGION_OPTIONS = [
  { value: "BE", label: "Heel België" },
  { value: "BE1", label: "Brussels Hoofdstedelijk Gewest" },
  { value: "BE2", label: "Vlaams Gewest" },
  { value: "BE3", label: "Waals Gewest" },
  { value: "REMOTE", label: "Volledig op afstand" },
];
export const LANGUAGE_OPTIONS = [
  { value: "nl", label: "Nederlands" },
  { value: "fr", label: "Frans" },
  { value: "en", label: "Engels" },
  { value: "de", label: "Duits" },
];
