import {
  Html, Head, Body, Container, Section, Text, Button, Hr, Img, Link, Preview, Heading,
} from "@react-email/components";
import * as React from "react";

// Shared layout wrapper for all Noor Printables emails
export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        `}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#faf9f5", fontFamily: "'Inter', Arial, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px" }}>
          {/* Header */}
          <Section style={{ textAlign: "center" as const, padding: "20px 0 10px" }}>
            <Text style={{ fontSize: 24, fontWeight: 700, color: "#1a6b4a", margin: 0 }}>
              &#127769; Noor Printables
            </Text>
          </Section>

          {/* Content card */}
          <Section style={{
            backgroundColor: "#ffffff",
            borderRadius: 12,
            padding: "32px 24px",
            border: "1px solid #e8e4dc",
          }}>
            {children}
          </Section>

          {/* Footer */}
          <Section style={{ textAlign: "center" as const, padding: "24px 0" }}>
            <Text style={{ fontSize: 12, color: "#999", margin: 0 }}>
              Noor Printables — Islamic educational activities for kids
            </Text>
            <Text style={{ fontSize: 11, color: "#bbb", margin: "8px 0 0" }}>
              <Link href="{{unsubscribe}}" style={{ color: "#bbb" }}>Unsubscribe</Link>
              {" · "}
              <Link href="https://noorprintables.com" style={{ color: "#bbb" }}>Visit website</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Shared CTA button
export function CtaButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: "#1a6b4a",
        color: "#ffffff",
        fontSize: 16,
        fontWeight: 600,
        padding: "14px 32px",
        borderRadius: 8,
        textDecoration: "none",
        textAlign: "center" as const,
      }}
    >
      {children}
    </Button>
  );
}

export function GoldButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button
      href={href}
      style={{
        display: "inline-block",
        backgroundColor: "#c9920a",
        color: "#ffffff",
        fontSize: 16,
        fontWeight: 600,
        padding: "14px 32px",
        borderRadius: 8,
        textDecoration: "none",
        textAlign: "center" as const,
      }}
    >
      {children}
    </Button>
  );
}

// Re-export all components used in templates
export { Html, Head, Body, Container, Section, Text, Button, Hr, Img, Link, Preview, Heading };
