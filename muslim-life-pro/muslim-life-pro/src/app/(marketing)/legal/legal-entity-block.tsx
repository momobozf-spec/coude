import { legalEntity } from '@/config/legal'

/** The operator's identity, exactly as configured — missing fields are shown as missing, never invented. */
export function LegalEntityBlock() {
  const legal = legalEntity()
  const missing = !legal.name || !legal.vat || !legal.address || !legal.email

  return (
    <div className="rounded-xl border border-border bg-surface-sunken p-5 text-sm leading-relaxed">
      <p className="font-medium">{legal.name ?? 'Operator name not configured'}</p>
      {legal.vat ? <p>Enterprise / VAT number: {legal.vat}</p> : null}
      {legal.address ? <p>Registered office: {legal.address}</p> : null}
      {legal.email ? (
        <p>
          Contact:{' '}
          <a className="text-primary hover:underline" href={`mailto:${legal.email}`}>
            {legal.email}
          </a>
        </p>
      ) : null}
      {missing ? (
        <p className="mt-2 text-xs text-danger">
          Some operator details are not configured yet (LEGAL_ENTITY_NAME, LEGAL_ENTITY_VAT,
          LEGAL_ENTITY_ADDRESS, LEGAL_CONTACT_EMAIL).
        </p>
      ) : null}
    </div>
  )
}
