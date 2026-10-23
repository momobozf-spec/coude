"use client";
import { useState } from "react";
import type { ProfileCertification, ProfileReference, TriState } from "@/db/schema";

type ProfileData = {
  companyName: string;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  services: string[];
  expertise: string | null;
  technologies: string[];
  excludedWork: string[];
  languages: string[];
  regions: string[];
  teamSize: number | null;
  availableCapacityFte: string | null;
  contractValueMinEur: string | null;
  contractValueMaxEur: string | null;
  publicSectorExperience: TriState;
  openToConsortium: TriState;
  openToSubcontracting: TriState;
  annualRevenueEur: string | null;
  references: ProfileReference[];
  certifications: ProfileCertification[];
};

const SERVICES = [
  { value: "cloud_azure", label: "Azure en cloudimplementaties" },
  { value: "fabric_powerbi", label: "Microsoft Fabric en Power BI" },
  { value: "databricks_engineering", label: "Databricks en data-engineering" },
  { value: "dwh_analytics_governance", label: "Datawarehousing, analytics en datagovernance" },
];
const REGIONS = [
  { value: "BE", label: "Heel België" },
  { value: "BE1", label: "Brussels Gewest" },
  { value: "BE2", label: "Vlaams Gewest" },
  { value: "BE3", label: "Waals Gewest" },
  { value: "REMOTE", label: "Volledig op afstand" },
];
const LANGS = [
  { value: "nl", label: "Nederlands" },
  { value: "fr", label: "Frans" },
  { value: "en", label: "Engels" },
  { value: "de", label: "Duits" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function Tri({ name, value, label }: { name: string; value: TriState; label: string }) {
  return (
    <div className="space-y-1">
      <label>{label}</label>
      <select name={name} defaultValue={value}>
        <option value="unknown">Onbekend</option>
        <option value="yes">Ja</option>
        <option value="no">Nee</option>
      </select>
    </div>
  );
}

export function ProfileForm({
  action,
  initial,
  hiddenFields,
  submitLabel = "Profiel opslaan",
  showConfirm = false,
}: {
  action: (fd: FormData) => Promise<void>;
  initial: ProfileData | null;
  hiddenFields?: Record<string, string>;
  submitLabel?: string;
  showConfirm?: boolean;
}) {
  const [refs, setRefs] = useState<ProfileReference[]>(initial?.references ?? []);
  const [certs, setCerts] = useState<ProfileCertification[]>(initial?.certifications ?? []);
  const i = initial;
  const box = "rounded-lg border border-line bg-white p-4";
  return (
    <form action={action} className="space-y-5">
      {Object.entries(hiddenFields ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="references_json" value={JSON.stringify(refs)} />
      <input type="hidden" name="certifications_json" value={JSON.stringify(certs)} />

      <section className={box}>
        <h3 className="mb-3 font-semibold text-navy-900">Bedrijf</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><label>Bedrijfsnaam *</label><input name="companyName" type="text" required defaultValue={i?.companyName ?? ""} /></div>
          <div className="space-y-1"><label>Website</label><input name="website" type="url" defaultValue={i?.website ?? ""} placeholder="https://" /></div>
          <div className="space-y-1"><label>Contactpersoon</label><input name="contactName" type="text" defaultValue={i?.contactName ?? ""} /></div>
          <div className="space-y-1"><label>E-mail contactpersoon</label><input name="contactEmail" type="email" defaultValue={i?.contactEmail ?? ""} /></div>
        </div>
      </section>

      <section className={box}>
        <h3 className="mb-3 font-semibold text-navy-900">Diensten en expertise</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {SERVICES.map((s) => (
            <label key={s.value} className="flex items-center gap-2 font-normal"><input type="checkbox" name="services" value={s.value} defaultChecked={i?.services.includes(s.value)} /> {s.label}</label>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><label>Concrete expertise</label><textarea name="expertise" defaultValue={i?.expertise ?? ""} placeholder="bv. migraties van on-prem DWH naar Databricks lakehouse, Power BI met RLS…" /></div>
          <div className="space-y-1"><label>Technologieën</label><input name="technologies" type="text" defaultValue={i?.technologies.join(", ") ?? ""} placeholder="Databricks, Power BI, Azure Data Factory" /><p className="text-xs text-muted">Kommagescheiden; worden gezocht in de opdrachttekst.</p></div>
          <div className="space-y-1"><label>Uitgesloten werkzaamheden</label><input name="excludedWork" type="text" defaultValue={i?.excludedWork.join(", ") ?? ""} placeholder="hardwarelevering, 24/7 helpdesk" /><p className="text-xs text-muted">Komt dit voor in een opdracht, dan is dat een harde blokkade.</p></div>
        </div>
      </section>

      <section className={box}>
        <h3 className="mb-3 font-semibold text-navy-900">Talen, regio en capaciteit</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label>Werktalen</label><div className="mt-1 flex flex-wrap gap-3">{LANGS.map((l) => <label key={l.value} className="flex items-center gap-1 font-normal"><input type="checkbox" name="languages" value={l.value} defaultChecked={i?.languages.includes(l.value)} /> {l.label}</label>)}</div></div>
          <div><label>Werkregio&apos;s</label><div className="mt-1 flex flex-wrap gap-3">{REGIONS.map((r) => <label key={r.value} className="flex items-center gap-1 font-normal"><input type="checkbox" name="regions" value={r.value} defaultChecked={i?.regions.includes(r.value)} /> {r.label}</label>)}</div></div>
          <div className="space-y-1"><label>Teamgrootte (medewerkers)</label><input name="teamSize" type="text" inputMode="numeric" defaultValue={i?.teamSize ?? ""} /></div>
          <div className="space-y-1"><label>Beschikbare capaciteit (VTE)</label><input name="availableCapacityFte" type="text" inputMode="decimal" defaultValue={i?.availableCapacityFte ?? ""} /></div>
          <div className="space-y-1"><label>Gewenste contractomvang min (EUR)</label><input name="contractValueMinEur" type="text" inputMode="numeric" defaultValue={i?.contractValueMinEur ?? ""} /></div>
          <div className="space-y-1"><label>Gewenste contractomvang max (EUR)</label><input name="contractValueMaxEur" type="text" inputMode="numeric" defaultValue={i?.contractValueMaxEur ?? ""} /></div>
        </div>
      </section>

      <section className={box}>
        <h3 className="mb-3 font-semibold text-navy-900">Overheidservaring en samenwerking</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Tri name="publicSectorExperience" value={i?.publicSectorExperience ?? "unknown"} label="Ervaring met overheidsopdrachten" />
          <Tri name="openToConsortium" value={i?.openToConsortium ?? "unknown"} label="Bereid tot samenwerking (combinatie)" />
          <Tri name="openToSubcontracting" value={i?.openToSubcontracting ?? "unknown"} label="Bereid tot onderaanneming" />
        </div>
        <div className="mt-3 max-w-sm space-y-1">
          <label>Jaaromzet (EUR) — optioneel</label>
          <input name="annualRevenueEur" type="text" inputMode="numeric" defaultValue={i?.annualRevenueEur ?? ""} />
          <p className="text-xs text-muted">Enkel invullen als het nodig is om financiële selectievoorwaarden te toetsen.</p>
        </div>
      </section>

      <section className={box}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-navy-900">Referenties</h3>
          <div className="flex gap-2">
            <button type="button" className="rounded border border-line px-2 py-1 text-sm" onClick={() => setRefs([...refs, { id: uid(), holder: "company", title: "", publicSector: "unknown", technologies: [], clientName: null, year: null, valueEur: null, description: null }])}>+ Bedrijfsreferentie</button>
            <button type="button" className="rounded border border-line px-2 py-1 text-sm" onClick={() => setRefs([...refs, { id: uid(), holder: "individual", title: "", publicSector: "unknown", technologies: [], clientName: null, year: null, valueEur: null, description: null }])}>+ Ervaring medewerker</button>
          </div>
        </div>
        <p className="mb-3 text-xs text-muted">Bedrijfsreferenties (uitgevoerd door het bedrijf) en individuele ervaring van medewerkers worden apart bijgehouden: aanbestedingen maken dat onderscheid vaak expliciet.</p>
        {refs.length === 0 && <p className="text-sm italic text-warn-700">Geen referenties opgegeven — referentievoorwaarden blijven “onbekend”.</p>}
        <div className="space-y-3">
          {refs.map((r, idx) => (
            <div key={r.id} className="grid gap-2 rounded-md border border-line p-3 sm:grid-cols-6">
              <div className="sm:col-span-6 flex items-center justify-between">
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${r.holder === "company" ? "bg-navy-100 text-navy-800" : "bg-warn-50 text-warn-700"}`}>{r.holder === "company" ? "Bedrijfsreferentie" : "Individuele ervaring"}</span>
                <button type="button" className="text-xs text-bad-700 underline" onClick={() => setRefs(refs.filter((_, j) => j !== idx))}>verwijderen</button>
              </div>
              <input className="sm:col-span-3" type="text" placeholder="Project / titel *" value={r.title} onChange={(e) => setRefs(refs.map((x, j) => (j === idx ? { ...x, title: e.target.value } : x)))} />
              <input className="sm:col-span-2" type="text" placeholder="Opdrachtgever" value={r.clientName ?? ""} onChange={(e) => setRefs(refs.map((x, j) => (j === idx ? { ...x, clientName: e.target.value || null } : x)))} />
              <input type="text" inputMode="numeric" placeholder="Jaar" value={r.year ?? ""} onChange={(e) => setRefs(refs.map((x, j) => (j === idx ? { ...x, year: e.target.value ? Number(e.target.value) : null } : x)))} />
              <input className="sm:col-span-2" type="text" placeholder="Technologieën (komma)" value={r.technologies.join(", ")} onChange={(e) => setRefs(refs.map((x, j) => (j === idx ? { ...x, technologies: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : x)))} />
              <input className="sm:col-span-2" type="text" inputMode="numeric" placeholder="Waarde (EUR)" value={r.valueEur ?? ""} onChange={(e) => setRefs(refs.map((x, j) => (j === idx ? { ...x, valueEur: e.target.value ? Number(e.target.value) : null } : x)))} />
              <select className="sm:col-span-2" value={r.publicSector} onChange={(e) => setRefs(refs.map((x, j) => (j === idx ? { ...x, publicSector: e.target.value as TriState } : x)))}>
                <option value="unknown">Overheid: onbekend</option><option value="yes">Overheidsopdracht</option><option value="no">Privé</option>
              </select>
              <textarea className="sm:col-span-6" rows={2} placeholder="Korte omschrijving" value={r.description ?? ""} onChange={(e) => setRefs(refs.map((x, j) => (j === idx ? { ...x, description: e.target.value || null } : x)))} />
            </div>
          ))}
        </div>
      </section>

      <section className={box}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-navy-900">Certificeringen</h3>
          <div className="flex gap-2">
            <button type="button" className="rounded border border-line px-2 py-1 text-sm" onClick={() => setCerts([...certs, { id: uid(), holder: "company", name: "", validUntil: null }])}>+ Bedrijf</button>
            <button type="button" className="rounded border border-line px-2 py-1 text-sm" onClick={() => setCerts([...certs, { id: uid(), holder: "individual", name: "", validUntil: null }])}>+ Medewerker</button>
          </div>
        </div>
        <div className="space-y-2">
          {certs.map((c, idx) => (
            <div key={c.id} className="grid items-center gap-2 sm:grid-cols-[140px_1fr_160px_auto]">
              <span className="text-xs font-semibold">{c.holder === "company" ? "Bedrijf" : "Medewerker"}</span>
              <input type="text" placeholder="Naam (bv. ISO 27001, DP-203)" value={c.name} onChange={(e) => setCerts(certs.map((x, j) => (j === idx ? { ...x, name: e.target.value } : x)))} />
              <input type="date" value={c.validUntil ?? ""} onChange={(e) => setCerts(certs.map((x, j) => (j === idx ? { ...x, validUntil: e.target.value || null } : x)))} />
              <button type="button" className="text-xs text-bad-700 underline" onClick={() => setCerts(certs.filter((_, j) => j !== idx))}>verwijderen</button>
            </div>
          ))}
          {certs.length === 0 && <p className="text-sm italic text-warn-700">Geen certificeringen opgegeven.</p>}
        </div>
      </section>

      {showConfirm && (
        <label className="flex items-center gap-2 font-normal">
          <input type="checkbox" name="confirm" /> Ik bevestig dat dit profiel actueel en correct is.
        </label>
      )}
      <button type="submit" className="rounded-md bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800">{submitLabel}</button>
      <p className="text-xs text-muted">Ontbrekende gegevens blijven “onbekend” en worden nooit als voldaan beschouwd. Een profielwijziging zet lopende beoordelingen opnieuw ter controle.</p>
    </form>
  );
}
