import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TenderKompas IT", template: "%s · TenderKompas IT" },
  description:
    "Gecontroleerde selectie van openbare opdrachten voor kleine Belgische data- en cloudbureaus, met uitleg over aansluiting, voorwaarden en volgende stappen.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
