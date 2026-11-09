import { NextIntlClientProvider, hasLocale } from "next-intl";
import { fontVariables } from "@/lib/fonts";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import Providers from "@/components/Providers";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CartDrawer from "@/components/layout/CartDrawer";
import CookieBanner from "@/components/layout/CookieBanner";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import Analytics from "@/components/Analytics";
import { marketplaceEnabled } from "@/lib/features";
import { legalEntity } from "@/lib/legal";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const marketplace = marketplaceEnabled();
  const legal = legalEntity();
  const messages = (await import(`../../../messages/${locale}.json`)).default;

  return (
    <html lang={locale} className={`h-full antialiased ${fontVariables}`}>
      <body className="min-h-full flex flex-col">
        <Analytics />
        <Providers>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <Header marketplace={marketplace} />
            <main className="flex-1 pb-16 lg:pb-0">{children}</main>
            <Footer marketplace={marketplace} contactEmail={legal.email} legalName={legal.name} legalVat={legal.vat} legalAddress={legal.displayAddress} />
            <CartDrawer />
            <CookieBanner />
            <MobileBottomNav />
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
