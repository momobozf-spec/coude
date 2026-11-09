'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/icons';
import { NAV_SECTIONS, isActivePath } from '@/lib/navigation';
import { ThemeToggle } from '@/components/theme/theme-toggle';

export interface SidebarCounts {
  inbox?: number;
  today?: number;
  overdue?: number;
}

export interface SidebarProject {
  id: string;
  name: string;
  color: string;
  progress: number;
}

interface SidebarProps {
  workspaceName: string;
  userName: string;
  counts?: SidebarCounts;
  projects?: SidebarProject[];
  onQuickCapture(): void;
  onOpenCommandPalette(): void;
}

export function Sidebar({
  workspaceName,
  userName,
  counts = {},
  projects = [],
  onQuickCapture,
  onOpenCommandPalette,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-dvh w-[260px] shrink-0 flex-col border-r border-line-subtle bg-surface lg:flex">
      <div className="flex items-center gap-2 px-3 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-ink-on-accent">
          <OrbitMark />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{workspaceName}</p>
          <p className="truncate text-xs text-ink-tertiary">{userName}</p>
        </div>
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onQuickCapture}
          className="flex w-full items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-ink-on-accent transition-colors duration-150 ease-standard hover:bg-accent-hover active:bg-accent-active"
        >
          <Icon name="plus" size={18} />
          Nieuw
          <kbd className="ml-auto rounded border border-white/25 px-1.5 py-0.5 text-[10px] font-normal opacity-80">
            N
          </kbd>
        </button>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="mt-2 flex w-full items-center gap-2 rounded-lg border border-line-subtle bg-canvas px-3 py-2 text-sm text-ink-tertiary transition-colors duration-150 ease-standard hover:border-line hover:text-ink-secondary"
        >
          <Icon name="search" size={16} />
          Zoeken
          <kbd className="ml-auto rounded border border-line px-1.5 py-0.5 text-[10px]">
            &#8984;K
          </kbd>
        </button>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.id} className="mb-4">
            {section.label ? (
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                {section.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActivePath(item.href, pathname);
                const count = item.counter ? counts[item.counter] : undefined;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={clsx(
                        'group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 ease-standard',
                        active
                          ? 'bg-accent-subtle font-medium text-accent-text'
                          : 'text-ink-secondary hover:bg-hovered hover:text-ink',
                      )}
                    >
                      <Icon
                        name={item.icon}
                        size={18}
                        className={active ? 'text-accent-text' : 'text-ink-tertiary'}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {count !== undefined && count > 0 ? (
                        <span
                          className={clsx(
                            'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
                            item.counter === 'overdue'
                              ? 'bg-danger-bg text-danger'
                              : 'bg-subtle text-ink-tertiary',
                          )}
                        >
                          {count}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {projects.length > 0 ? (
          <div className="mb-4">
            <div className="mb-1 flex items-center justify-between px-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                Projecten
              </p>
              <Link
                href="/projecten"
                className="text-ink-tertiary transition-colors hover:text-ink-secondary"
                aria-label="Alle projecten"
              >
                <Icon name="chevron-right" size={14} />
              </Link>
            </div>
            <ul className="space-y-0.5">
              {projects.slice(0, 8).map((project) => {
                const href = `/projecten/${project.id}`;
                const active = isActivePath(href, pathname);
                return (
                  <li key={project.id}>
                    <Link
                      href={href}
                      className={clsx(
                        'flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 ease-standard',
                        active
                          ? 'bg-accent-subtle font-medium text-accent-text'
                          : 'text-ink-secondary hover:bg-hovered hover:text-ink',
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: project.color }}
                        aria-hidden
                      />
                      <span className="flex-1 truncate">{project.name}</span>
                      <span className="text-[11px] tabular-nums text-ink-tertiary">
                        {project.progress}%
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </nav>

      <div className="flex items-center gap-1 border-t border-line-subtle px-3 py-2">
        <Link
          href="/instellingen"
          className="flex flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink-secondary transition-colors hover:bg-hovered hover:text-ink"
        >
          <Icon name="settings" size={18} className="text-ink-tertiary" />
          Instellingen
        </Link>
        <ThemeToggle />
      </div>
    </aside>
  );
}

/** Het merkteken: drie banen om een kern, in één SVG zonder externe assets. */
function OrbitMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <ellipse
        cx="12"
        cy="12"
        rx="9.5"
        ry="4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.9"
        transform="rotate(-28 12 12)"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="9.5"
        ry="4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.5"
        transform="rotate(45 12 12)"
      />
    </svg>
  );
}
