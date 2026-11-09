import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import type { Locale } from "@/lib/locales";

export function AccountDeletedEmail({
  locale,
  name,
  copy,
}: {
  locale: Locale;
  name: string;
  copy: { subject: string; heading: string; intro: string; body: string; footer: string };
}) {
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

          <Hr style={{ borderColor: "#e8f2ed", margin: "24px 0 12px" }} />

          <Text style={{ color: "#94a3b8", fontSize: "12px", margin: 0 }}>{copy.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}
