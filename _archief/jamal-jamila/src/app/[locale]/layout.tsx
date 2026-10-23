import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import Providers from "@/components/Providers";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CartDrawer from "@/components/layout/CartDrawer";
import CookieBanner from "@/components/layout/CookieBanner";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import Analytics from "@/components/Analytics";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const messages = (await import(`../../../messages/${locale}.json`)).default;

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Analytics />
        <Providers>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <Header />
            <main className="flex-1 pb-16 lg:pb-0">{children}</main>
            <Footer />
            <CartDrawer />
            <CookieBanner />
            <MobileBottomNav />
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
