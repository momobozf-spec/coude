import { ExternalLink, MapPin } from 'lucide-react'

import { Card } from '@/components/ui/card'
import type { MapViewModel } from '@/server/integrations/maps'

/**
 * Location panel.
 *
 * Renders whatever the map provider returned. No vendor SDK, no API key in the
 * client, and no device-location request — a member can read a business page
 * without granting anything.
 */
export function BusinessMap({ map, name }: { map: MapViewModel; name: string }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <MapPin className="size-3.5 text-muted-foreground" aria-hidden />
        Location
      </h2>

      <Card variant="sunken" className="mt-3 overflow-hidden">
        {map.kind === 'embed' && map.embedUrl ? (
          <iframe
            src={map.embedUrl}
            title={`Map showing ${name}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-48 w-full border-0"
            allowFullScreen={false}
          />
        ) : null}

        {map.kind === 'static' && map.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- provider URL, not a local asset
          <img
            src={map.imageUrl}
            alt={`Map showing the location of ${name}`}
            className="h-48 w-full object-cover"
            loading="lazy"
          />
        ) : null}

        {map.kind === 'address-only' ? (
          <div
            className="flex h-32 items-center justify-center bg-primary-subtle"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, color-mix(in oklch, var(--primary) 16%, transparent) 1px, transparent 0)',
              backgroundSize: '16px 16px',
            }}
            aria-hidden
          >
            <MapPin className="size-6 text-primary-subtle-foreground/60" />
          </div>
        ) : null}

        <div className="space-y-3 p-4">
          <address className="not-italic text-sm leading-relaxed text-foreground">
            {map.formattedAddress}
          </address>

          {map.notice ? <p className="text-xs text-muted-foreground">{map.notice}</p> : null}

          <a
            href={map.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            Open in maps
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
      </Card>
    </div>
  )
}
