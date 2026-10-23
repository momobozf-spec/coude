import Link from 'next/link'

import { Logo } from '@/components/layout/logo'
import { siteConfig } from '@/config/site'
import { legalEntity } from '@/config/legal'
import { t } from '@/i18n'

interface FooterLink {
  href: string
  label: string
}

export function MarketingFooter() {
  const legal = legalEntity()

  const columns: { heading: string; links: FooterLink[] }[] = [
    {
      heading: t('landing.footer.product'),
      links: [
        { href: '/#features', label: 'Features' },
        { href: '/pricing', label: t('nav.pricing') },
        { href: '/#assistant', label: t('nav.assistant') },
        { href: '/#faq', label: 'FAQ' },
      ],
    },
    {
      heading: t('landing.footer.legal'),
      links: [
        { href: '/legal/privacy', label: t('landing.footer.privacy') },
        { href: '/legal/terms', label: t('landing.footer.terms') },
        ...(legal.email
          ? [{ href: `mailto:${legal.email}`, label: t('landing.footer.contact') }]
          : []),
      ],
    },
  ]

  return (
    <footer className="border-t border-border bg-surface-sunken">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {siteConfig.description}
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.heading}>
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {column.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {t('landing.footer.disclaimer')}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            © {new Date().getFullYear()} {legal.name ?? siteConfig.name}
            {legal.vat ? ` · ${legal.vat}` : ''}
            {legal.address ? ` · ${legal.address}` : ''}. {t('landing.footer.rights')}
          </p>
        </div>
      </div>
    </footer>
  )
}
