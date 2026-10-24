import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/legal-document';
import { legalAddress } from '@/lib/legal';

export const metadata: Metadata = { title: 'Cookies' };

export default function CookiesPage() {
  return <LegalDocumentView document="cookies" address={legalAddress()} />;
}
