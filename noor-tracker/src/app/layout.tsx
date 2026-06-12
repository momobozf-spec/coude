import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { Providers } from "@/components/Providers";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Noor Tracker — Islamitische gewoontes voor kinderen",
  description:
    "Help je kind om islamitische gewoontes op te bouwen, stap voor stap. Dagelijkse gebeden, Quran lezen, en meer — met sterren als beloning!",
  keywords: ["islam", "kinderen", "gewoontes", "gebed", "quran", "tracker"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Noor Tracker",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Noor Tracker — Islamitische gewoontes voor kinderen",
    description:
      "Help je kind om islamitische gewoontes op te bouwen met sterren en streaks.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1a6b4a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className={nunito.variable}>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Noor Tracker" />
      </head>
      <body className="font-nunito antialiased bg-[#fafdf8] text-gray-900">
        <Providers>
          {children}
          <PWAInstallPrompt />
        </Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
