import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/legal-document';
import { legalAddress } from '@/lib/legal';

export const metadata: Metadata = { title: 'Gebruiksvoorwaarden' };

export default function TermsPage() {
  return <LegalDocumentView document="terms" address={legalAddress()} />;
}
