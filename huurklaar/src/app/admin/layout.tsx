import type { Metadata, Viewport } from "next";
import "@fontsource-variable/mona-sans/wght.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "../globals.css";

export const metadata: Metadata = {
  title: "Huurklaar Beheer",
  robots: { index: false, follow: false, nocache: true },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl-BE">
      <body>{children}</body>
    </html>
  );
}
