'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import type {
  PropertyFormState,
} from '@/app/[locale]/(app)/properties/actions';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/nl';
import type { Property } from '@/lib/supabase/types';
import { Alert, Card, CardHeader } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field';
import { municipalityFor, municipalityOptions } from '@/lib/properties/brussels';
import { depositExceedsTwoMonths } from '@/lib/properties/schema';

const INITIAL: PropertyFormState = { error: null };

/**
 * Vertaalt validatiecodes uit het schema. Zod-standaardmeldingen zijn Engels;
 * die vangen wij hier af zodat er geen Engelse tekst in de UI verschijnt.
 */
function fieldError(
  codes: string[] | undefined,
  locale: Locale,
): string | null {
  const code = codes?.[0];
  if (!code) return null;

  const map: Record<string, { nl: string; fr: string }> = {
    NOT_BRUSSELS: {
      nl:
        'Deze postcode ligt buiten het Brussels Hoofdstedelijk Gewest. ' +
        'RentGuard is op Brussels huurrecht gebouwd en zou u elders verkeerd informeren.',
      fr:
        'Ce code postal se situe en dehors de la Région de Bruxelles-Capitale. ' +
        'RentGuard est construit sur le droit locatif bruxellois et vous informerait mal ailleurs.',
    },
    INVALID_AMOUNT: {
      nl: 'Vul een bedrag in, zonder euroteken.',
      fr: 'Indiquez un montant, sans symbole euro.',
    },
    INVALID_DATE: {
      nl: 'Vul een geldige datum in.',
      fr: 'Indiquez une date valide.',
    },
    END_BEFORE_START: {
      nl: 'De einddatum ligt vóór de begindatum.',
      fr: 'La date de fin précède la date de début.',
    },
    SIGNED_AFTER_START: {
      nl: 'De ondertekening kan niet ná de aanvang van de huur liggen.',
      fr: 'La signature ne peut pas être postérieure au début du bail.',
    },
  };

  if (map[code]) return map[code][locale];

  return locale === 'nl'
    ? 'Kijk dit veld na.'
    : 'Vérifiez ce champ.';
}

function SubmitButton({ label, busyLabel }: { label: string; busyLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? busyLabel : label}
    </Button>
  );
}

export function PropertyForm({
  locale,
  messages: t,
  action,
  property,
}: {
  locale: Locale;
  messages: Messages;
  action: (
    state: PropertyFormState,
    formData: FormData,
  ) => Promise<PropertyFormState>;
  property?: Property | null;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  const [postalCode, setPostalCode] = useState(property?.postal_code ?? '');
  const [municipality, setMunicipality] = useState(property?.municipality ?? '');
  const [monthlyRent, setMonthlyRent] = useState(
    property?.monthly_rent?.toString() ?? '',
  );
  const [depositAmount, setDepositAmount] = useState(
    property?.deposit_amount?.toString() ?? '',
  );

  const err = (name: string) => fieldError(state.fieldErrors?.[name], locale);

  const depositWarning = depositExceedsTwoMonths(
    Number.parseFloat(monthlyRent.replace(',', '.')) || null,
    Number.parseFloat(depositAmount.replace(',', '.')) || null,
  );

  function onPostalCodeChange(value: string) {
    setPostalCode(value);
    const match = municipalityFor(value, locale);
    if (match) setMunicipality(match);
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="locale" value={locale} />

      {state.error === 'SAVE_FAILED' ? (
        <Alert tone="critical">
          <p>{t.errors.generic}</p>
        </Alert>
      ) : null}

      <Card>
        <CardHeader title={t.property.title} />
        <div className="space-y-4">
          <Field
            label={t.property.address}
            htmlFor="address"
            required
            error={err('address')}
          >
            <Input
              name="address"
              defaultValue={property?.address ?? ''}
              autoComplete="street-address"
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t.property.postalCode}
              htmlFor="postalCode"
              required
              hint={t.property.postalCodeHelp}
              error={err('postalCode')}
            >
              <Input
                name="postalCode"
                value={postalCode}
                onChange={(e) => onPostalCodeChange(e.target.value)}
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                required
              />
            </Field>

            <Field
              label={t.property.municipality}
              htmlFor="municipality"
              required
              error={err('municipality')}
            >
              <Input
                name="municipality"
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
                list="municipalities"
                required
              />
            </Field>
          </div>

          <datalist id="municipalities">
            {municipalityOptions(locale).map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t.property.surface}
              htmlFor="surfaceM2"
              error={err('surfaceM2')}
            >
              <Input
                name="surfaceM2"
                defaultValue={property?.surface_m2?.toString() ?? ''}
                inputMode="decimal"
              />
            </Field>
            <Field
              label={t.property.bedrooms}
              htmlFor="bedrooms"
              error={err('bedrooms')}
            >
              <Input
                name="bedrooms"
                defaultValue={property?.bedrooms?.toString() ?? ''}
                inputMode="numeric"
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={locale === 'nl' ? 'Huurprijs en waarborg' : 'Loyer et garantie'}
        />
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t.property.monthlyRent}
              htmlFor="monthlyRent"
              error={err('monthlyRent')}
            >
              <Input
                name="monthlyRent"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field
              label={t.property.monthlyCharges}
              htmlFor="monthlyCharges"
              error={err('monthlyCharges')}
            >
              <Input
                name="monthlyCharges"
                defaultValue={property?.monthly_charges?.toString() ?? ''}
                inputMode="decimal"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t.property.depositAmount}
              htmlFor="depositAmount"
              error={err('depositAmount')}
            >
              <Input
                name="depositAmount"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field
              label={t.property.depositType}
              htmlFor="depositType"
              error={err('depositType')}
            >
              <Select
                name="depositType"
                defaultValue={property?.deposit_type ?? 'UNKNOWN'}
              >
                <option value="UNKNOWN">
                  {locale === 'nl' ? 'Weet ik niet' : 'Je ne sais pas'}
                </option>
                <option value="INDIVIDUAL_ACCOUNT">
                  {locale === 'nl'
                    ? 'Geïndividualiseerde rekening'
                    : 'Compte individualisé'}
                </option>
                <option value="BANK_GUARANTEE_CPAS">
                  {locale === 'nl'
                    ? 'Bankwaarborg via OCMW'
                    : 'Garantie bancaire via CPAS'}
                </option>
                <option value="PROGRESSIVE_BANK_GUARANTEE">
                  {locale === 'nl'
                    ? 'Progressieve bankwaarborg'
                    : 'Garantie bancaire progressive'}
                </option>
                <option value="REAL_SECURITY">
                  {locale === 'nl' ? 'Zakelijke zekerheid' : 'Sûreté réelle'}
                </option>
                <option value="PERSONAL_SURETY">
                  {locale === 'nl'
                    ? 'Persoonlijke borgstelling (studentenhuur)'
                    : 'Caution personnelle (bail étudiant)'}
                </option>
                <option value="OTHER">
                  {locale === 'nl' ? 'Andere' : 'Autre'}
                </option>
              </Select>
            </Field>
          </div>

          {depositWarning ? (
            <Alert
              tone="warning"
              title={
                locale === 'nl'
                  ? 'Uw waarborg lijkt hoger dan twee maanden huur'
                  : 'Votre garantie semble dépasser deux mois de loyer'
              }
            >
              <p>
                {locale === 'nl'
                  ? 'Voor Brusselse huurovereenkomsten gesloten of hernieuwd ' +
                    'vanaf 1 november 2024 bedraagt de waarborg maximaal twee ' +
                    'maanden huur. Voor oudere contracten kan een hoger bedrag ' +
                    'wel correct zijn. Dit is een signalering, geen oordeel.'
                  : 'Pour les baux bruxellois conclus ou renouvelés à partir du ' +
                    '1er novembre 2024, la garantie s’élève à maximum deux mois ' +
                    'de loyer. Pour des baux plus anciens, un montant supérieur ' +
                    'peut être correct. Ceci est un signalement, pas un jugement.'}
              </p>
            </Alert>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          title={locale === 'nl' ? 'Huurovereenkomst' : 'Contrat de bail'}
          description={
            locale === 'nl'
              ? 'Deze data bepalen welke regels op uw contract van toepassing zijn.'
              : 'Ces dates déterminent quelles règles s’appliquent à votre bail.'
          }
        />
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label={t.property.leaseSignedOn}
              htmlFor="leaseSignedOn"
              error={err('leaseSignedOn')}
            >
              <Input
                name="leaseSignedOn"
                type="date"
                defaultValue={property?.lease_signed_on ?? ''}
              />
            </Field>
            <Field
              label={t.property.leaseStart}
              htmlFor="leaseStart"
              error={err('leaseStart')}
            >
              <Input
                name="leaseStart"
                type="date"
                defaultValue={property?.lease_start ?? ''}
              />
            </Field>
            <Field
              label={t.property.leaseEnd}
              htmlFor="leaseEnd"
              error={err('leaseEnd')}
            >
              <Input
                name="leaseEnd"
                type="date"
                defaultValue={property?.lease_end ?? ''}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label={t.property.leaseRegistered}
              htmlFor="leaseRegistered"
              error={err('leaseRegistered')}
            >
              <Select
                name="leaseRegistered"
                defaultValue={
                  property?.lease_registered === null ||
                  property?.lease_registered === undefined
                    ? 'unknown'
                    : property.lease_registered
                      ? 'yes'
                      : 'no'
                }
              >
                <option value="unknown">
                  {locale === 'nl' ? 'Weet ik niet' : 'Je ne sais pas'}
                </option>
                <option value="yes">{locale === 'nl' ? 'Ja' : 'Oui'}</option>
                <option value="no">{locale === 'nl' ? 'Nee' : 'Non'}</option>
              </Select>
            </Field>

            <Field
              label={t.property.pebCertificateProvided}
              htmlFor="pebCertificateProvided"
              error={err('pebCertificateProvided')}
            >
              <Select
                name="pebCertificateProvided"
                defaultValue={
                  property?.peb_certificate_provided === null ||
                  property?.peb_certificate_provided === undefined
                    ? 'unknown'
                    : property.peb_certificate_provided
                      ? 'yes'
                      : 'no'
                }
              >
                <option value="unknown">
                  {locale === 'nl' ? 'Weet ik niet' : 'Je ne sais pas'}
                </option>
                <option value="yes">{locale === 'nl' ? 'Ja' : 'Oui'}</option>
                <option value="no">{locale === 'nl' ? 'Nee' : 'Non'}</option>
              </Select>
            </Field>

            <Field
              label={t.property.pebRating}
              htmlFor="pebRating"
              error={err('pebRating')}
            >
              <Select name="pebRating" defaultValue={property?.peb_rating ?? ''}>
                <option value="">
                  {locale === 'nl' ? 'Onbekend' : 'Inconnu'}
                </option>
                {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={locale === 'nl' ? 'Verhuurder' : 'Bailleur'}
          description={t.property.landlordDataPurpose}
        />
        <div className="space-y-4">
          <Field
            label={t.property.landlordName}
            htmlFor="landlordName"
            error={err('landlordName')}
          >
            <Input name="landlordName" defaultValue={property?.landlord_name ?? ''} />
          </Field>

          <Field
            label={t.property.landlordAddress}
            htmlFor="landlordAddress"
            error={err('landlordAddress')}
          >
            <Textarea
              name="landlordAddress"
              defaultValue={property?.landlord_address ?? ''}
              rows={3}
            />
          </Field>

          <Field
            label={t.property.landlordEmail}
            htmlFor="landlordEmail"
            error={err('landlordEmail')}
          >
            <Input
              name="landlordEmail"
              type="email"
              inputMode="email"
              defaultValue={property?.landlord_email ?? ''}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title={t.privacy.retentionTitle} />
        <div className="space-y-4">
          <Field
            label={
              locale === 'nl'
                ? 'Bewaartermijn na einde huur (jaren)'
                : 'Durée de conservation après la fin du bail (années)'
            }
            htmlFor="retentionYears"
            error={err('retentionYears')}
          >
            <Select
              name="retentionYears"
              defaultValue={String(property?.retention_years ?? 2)}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((years) => (
                <option key={years} value={years}>
                  {years}
                </option>
              ))}
            </Select>
          </Field>

          <Alert tone="warning">
            <p>{t.privacy.retentionWarning}</p>
          </Alert>
        </div>
      </Card>

      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <Checkbox id="confirm" required />
        <label htmlFor="confirm" className="text-sm text-slate-700">
          {locale === 'nl'
            ? 'Ik bevestig dat de ingevulde gegevens kloppen. Berekeningen en ' +
              'brieven vertrekken hiervan.'
            : 'Je confirme que les données saisies sont exactes. Les calculs et ' +
              'courriers en découlent.'}
        </label>
      </div>

      <SubmitButton label={t.common.save} busyLabel={t.common.loading} />
    </form>
  );
}
