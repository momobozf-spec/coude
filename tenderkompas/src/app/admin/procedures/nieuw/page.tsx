import { Card, Field, Flash, Notice, PageTitle, btn } from "@/components/ui";
import { createProcedureAction } from "../actions";

export const metadata = { title: "Opdracht invoeren" };

export default async function NewProcedure({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="max-w-3xl">
      <PageTitle title="Opdracht handmatig invoeren" subtitle="Voor publicaties die niet via een automatische bron binnenkomen (bv. Belgische e-Procurement)." />
      <Flash searchParams={sp} />
      <div className="mb-4">
        <Notice tone="info">
          Neem gegevens over zoals ze in de bron staan, in de oorspronkelijke taal. Omzeil geen aanmelding, CAPTCHA of toegangsbeperking: gebruik enkel
          openbare of rechtmatig verkregen documenten. Deadlines, waarden en voorwaarden voegt u na het aanmaken toe, telkens met bronverwijzing.
        </Notice>
      </div>
      <Card>
        <form action={createProcedureAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Bron *">
            <select name="sourceId" defaultValue="be-eprocurement" required>
              <option value="be-eprocurement">Belgische e-Procurement (publicprocurement.be)</option>
              <option value="manual">Andere openbare bron</option>
              <option value="demo">Demo — herkenbaar fictief</option>
            </select>
          </Field>
          <Field label="Officiële referentie *" hint="Referentie/dossiernummer zoals in de bron. Uniek per bron.">
            <input name="externalReference" type="text" required />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Bronlink" hint="Openbare URL van de publicatie.">
              <input name="sourceUrl" type="url" placeholder="https://" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Titel (oorspronkelijke taal) *">
              <input name="title" type="text" required />
            </Field>
          </div>
          <Field label="Taal van de titel">
            <select name="titleLanguage" defaultValue="NLD">
              <option value="NLD">Nederlands</option>
              <option value="FRA">Frans</option>
              <option value="ENG">Engels</option>
              <option value="DEU">Duits</option>
            </select>
          </Field>
          <Field label="Type publicatie *">
            <select name="noticeKind" defaultValue="cn-standard">
              <option value="cn-standard">Aankondiging van opdracht (oproep tot mededinging)</option>
              <option value="pin-only">Vooraankondiging</option>
              <option value="can-standard">Gunning / resultaat</option>
              <option value="cancellation">Intrekking / stopzetting</option>
            </select>
          </Field>
          <Field label="Opdrachtgever">
            <input name="buyerName" type="text" />
          </Field>
          <Field label="Land opdrachtgever" hint="ISO-code, bv. BEL">
            <input name="buyerCountry" type="text" defaultValue="BEL" maxLength={3} />
          </Field>
          <Field label="Plaats van uitvoering (NUTS)" hint="Kommagescheiden, bv. BE21, BE10. Leeg = onbekend.">
            <input name="performanceNuts" type="text" />
          </Field>
          <Field label="Publicatiedatum">
            <input name="publicationDate" type="date" />
          </Field>
          <Field label="Taal/talen van de procedure">
            <div className="flex gap-3 text-sm font-normal">
              {["NLD", "FRA", "ENG", "DEU"].map((l) => (
                <label key={l} className="flex items-center gap-1 font-normal"><input type="checkbox" name="officialLanguages" value={l} /> {l}</label>
              ))}
            </div>
          </Field>
          <Field label="Proceduretype" hint="Zoals in de bron (bv. openbare procedure, mededingingsprocedure met onderhandeling)">
            <input name="procedureType" type="text" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="CPV-codes" hint="Kommagescheiden, 8 cijfers (bv. 72300000).">
              <input name="cpvCodes" type="text" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Omschrijving (oorspronkelijke taal)">
              <textarea name="description" rows={6} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <button className={btn()} type="submit">Opdracht aanmaken</button>
          </div>
        </form>
      </Card>
    </div>
  );
}
