import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { PageHeader } from '@/components/ui/primitives';
import { MORE_ITEMS } from '@/lib/navigation';

export const metadata: Metadata = { title: 'Meer' };

/**
 * De mobiele "Meer"-pagina. Op desktop staan deze bestemmingen gewoon in de
 * sidebar; op een telefoon passen ze niet in de tabbar en verzamelen we ze hier.
 */
export default function MorePage() {
  return (
    <>
      <PageHeader title="Meer" />
      <div className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6">
        <ul className="divide-y divide-line-subtle overflow-hidden rounded-xl border border-line-subtle bg-surface">
          {MORE_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center gap-3 px-4 transition-colors hover:bg-hovered"
                style={{ minHeight: 52 }}
              >
                <Icon name={item.icon} size={20} className="text-ink-tertiary" />
                <span className="flex-1 text-base">{item.label}</span>
                <Icon name="chevron-right" size={18} className="text-ink-disabled" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
