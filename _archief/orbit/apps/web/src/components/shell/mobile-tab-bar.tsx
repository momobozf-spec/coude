'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/icons';
import { MOBILE_TABS, isActivePath } from '@/lib/navigation';

/**
 * De mobiele navigatie uit de requirements: Home, Taken, +, Notities, Meer.
 * De plus staat bewust in het midden en steekt uit — vastleggen is de handeling
 * die het vaakst gebeurt en moet met één duim bereikbaar zijn.
 */
export function MobileTabBar({ onQuickCapture }: { onQuickCapture(): void }) {
  const pathname = usePathname();
  const left = MOBILE_TABS.slice(0, 2);
  const right = MOBILE_TABS.slice(2);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 flex items-stretch border-t border-line-subtle bg-surface/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Hoofdnavigatie"
    >
      {left.map((tab) => (
        <TabLink key={tab.href} {...tab} active={isActivePath(tab.href, pathname)} />
      ))}

      <div className="flex flex-1 items-center justify-center">
        <button
          type="button"
          onClick={onQuickCapture}
          aria-label="Nieuw item"
          className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-ink-on-accent shadow-lg transition-transform duration-150 ease-spring active:scale-95"
        >
          <Icon name="plus" size={26} />
        </button>
      </div>

      {right.map((tab) => (
        <TabLink key={tab.href} {...tab} active={isActivePath(tab.href, pathname)} />
      ))}
    </nav>
  );
}

function TabLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors duration-150',
        active ? 'text-accent-text' : 'text-ink-tertiary',
      )}
      style={{ minHeight: 56 }}
    >
      <Icon name={icon} size={22} />
      {label}
    </Link>
  );
}
