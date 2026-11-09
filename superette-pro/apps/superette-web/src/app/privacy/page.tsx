import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/legal-document';
import { legalAddress } from '@/lib/legal';

export const metadata: Metadata = { title: 'Privacy' };

/** Server component: leest `LEGAL_ENTITY_ADDRESS` per request (nooit in de browserbundel gebakken). */
export default function PrivacyPage() {
  return <LegalDocumentView document="privacy" address={legalAddress()} />;
}
