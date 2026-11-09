import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { Locale } from "@/lib/locales";

type LinkEmailProps = {
  locale: Locale;
  name: string;
  url: string;
  copy: {
    subject: string;
    heading: string;
    intro: string;
    body: string;
    cta: string;
    ignore: string;
    footer: string;
  };
};

/**
 * One template for every "click this link" mail — password reset and e-mail
 * verification are the same shape, and two near-identical templates would drift.
 */
export function LinkEmail({ locale, name, url, copy }: LinkEmailProps) {
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{copy.subject}</Preview>
      <Body style={{ backgroundColor: "#e8f2ed", fontFamily: "Nunito, Arial, sans-serif" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            margin: "24px auto",
            maxWidth: "560px",
            padding: "32px",
          }}
        >
          <Text style={{ color: "#c9920a", fontWeight: 700, margin: 0 }}>Noor Club</Text>

          <Heading style={{ color: "#125037", fontSize: "24px", margin: "12px 0 0" }}>
            {copy.heading}
          </Heading>

          <Text style={{ color: "#475569", margin: "8px 0 0" }}>
            {name}, {copy.intro}
          </Text>

          <Text style={{ color: "#334155", margin: "16px 0 0" }}>{copy.body}</Text>

          <Section style={{ margin: "24px 0" }}>
            <Link
              href={url}
              style={{
                backgroundColor: "#1a6b4a",
                borderRadius: "999px",
                color: "#ffffff",
                display: "inline-block",
                fontWeight: 700,
                padding: "14px 28px",
                textDecoration: "none",
              }}
            >
              {copy.cta}
            </Link>
          </Section>

          <Text style={{ color: "#475569", fontSize: "14px", margin: 0 }}>{copy.ignore}</Text>

          <Hr style={{ borderColor: "#e8f2ed", margin: "24px 0 12px" }} />

          <Text style={{ color: "#94a3b8", fontSize: "12px", margin: 0 }}>{copy.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}
