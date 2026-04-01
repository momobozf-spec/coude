import * as React from "react";
import { EmailLayout, CtaButton, Text, Hr, Section, Heading } from "../components";

interface Props {
  name: string;
  plan: string;
  communityUrl: string;
}

export function CommunityWelcomeEmail({ name, plan, communityUrl }: Props) {
  const planName = plan === "school" ? "School" : "Pro";

  return (
    <EmailLayout preview={`Welcome to Noor Families! Your community is waiting, ${name}`}>
      <Section style={{ textAlign: "center" as const, marginBottom: 16 }}>
        <Text style={{ fontSize: 40, margin: 0 }}>&#127775;</Text>
      </Section>

      <Heading style={{ fontSize: 22, color: "#1a1a2e", margin: "0 0 8px", textAlign: "center" as const }}>
        Welcome to Noor Families!
      </Heading>

      <Text style={{ fontSize: 15, color: "#555", lineHeight: "1.6", textAlign: "center" as const }}>
        Assalamu Alaikum {name}! As a {planName} member, you now have access
        to our private community of Muslim parents and teachers.
      </Text>

      <Hr style={{ borderColor: "#e8e4dc", margin: "20px 0" }} />

      <Section style={{ backgroundColor: "#e8f5ec", borderRadius: 8, padding: 16, textAlign: "center" as const, marginBottom: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: 700, color: "#1a6b4a", margin: "0 0 4px" }}>
          Join 847 Muslim Families
        </Text>
        <Text style={{ fontSize: 13, color: "#555", margin: 0 }}>
          No new password needed — click below to enter automatically
        </Text>
      </Section>

      <Text style={{ fontSize: 14, fontWeight: 600, color: "#333", margin: "0 0 12px" }}>
        What&apos;s waiting for you:
      </Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 6px" }}>&#128101; Private discussions with Muslim parents</Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 6px" }}>&#128218; Weekly live Islamic parenting Q&A</Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 6px" }}>&#127912; Share your kids&apos; colored worksheets</Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 6px" }}>&#127769; Ramadan activities &amp; tips</Text>
      {plan === "school" && <Text style={{ fontSize: 14, color: "#555", margin: "0 0 6px" }}>&#127979; Exclusive Teachers Lounge</Text>}

      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <CtaButton href={communityUrl}>
          Enter Community Now &rarr;
        </CtaButton>
      </Section>

      <Text style={{ fontSize: 13, color: "#999", textAlign: "center" as const }}>
        &#128197; Next event: Tuesday live Q&A at 8:00 PM CET
      </Text>
    </EmailLayout>
  );
}
