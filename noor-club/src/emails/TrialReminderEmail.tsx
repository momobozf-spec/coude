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
import { reminderCopy } from "@/emails/copy";
import type { Locale } from "@/lib/locales";

export function TrialReminderEmail({
  locale,
  name,
  chargeDate,
  accountUrl,
}: {
  locale: Locale;
  name: string;
  chargeDate: string;
  accountUrl: string;
}) {
  const copy = reminderCopy[locale];

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

          <Section style={{ margin: "20px 0 0" }}>
            <Text style={{ color: "#334155", margin: 0 }}>{copy.body}</Text>
            <Text style={{ color: "#125037", fontWeight: 700, margin: "12px 0 0" }}>
              {copy.charge.replace("{date}", chargeDate)}
            </Text>
            <Text style={{ color: "#334155", margin: "12px 0 0" }}>{copy.keep}</Text>
          </Section>

          <Section style={{ margin: "24px 0" }}>
            <Link
              href={accountUrl}
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

          <Text style={{ color: "#475569", fontSize: "14px", margin: 0 }}>
            {copy.cancel}
          </Text>

          <Hr style={{ borderColor: "#e8f2ed", margin: "24px 0 12px" }} />

          <Text style={{ color: "#94a3b8", fontSize: "12px", margin: 0 }}>
            {copy.footer}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
