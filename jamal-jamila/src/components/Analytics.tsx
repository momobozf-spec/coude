import Script from "next/script";

/**
 * Analytics loaders. Each platform renders only when its env var is present, so
 * by default (no IDs configured) nothing is loaded. Replace the placeholders in
 * your environment to activate:
 *   NEXT_PUBLIC_GA_ID            e.g. G-XXXXXXXXXX
 *   NEXT_PUBLIC_META_PIXEL_ID    e.g. 123456789012345
 *   NEXT_PUBLIC_TIKTOK_PIXEL_ID  e.g. CXXXXXXXXXXXXXXXXX
 *
 * Note: for a fully GDPR-compliant setup these should fire only after cookie
 * consent. Wire them to your consent state in CookieBanner before launch.
 */
export default function Analytics() {
  const ga = process.env.NEXT_PUBLIC_GA_ID;
  const meta = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const tiktok = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;

  return (
    <>
      {ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga}');`}
          </Script>
        </>
      )}

      {meta && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${meta}');fbq('track', 'PageView');`}
        </Script>
      )}

      {tiktok && (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${tiktok}');ttq.page();}(window, document, 'ttq');`}
        </Script>
      )}
    </>
  );
}
