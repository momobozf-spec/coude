import * as React from "react";
import { EmailLayout, CtaButton, GoldButton, Text, Hr, Section, Heading } from "../components";

interface Props {
  name: string;
  sheetsGenerated: number;
  topThemes: string[];
  plan: string;
  appUrl: string;
}

export function MonthlyDigestEmail({ name, sheetsGenerated, topThemes, plan, appUrl }: Props) {
  return (
    <EmailLayout preview={`Your Noor Printables summary: ${sheetsGenerated} sheets created this month!`}>
      <Heading style={{ fontSize: 22, color: "#1a1a2e", margin: "0 0 8px" }}>
        Your monthly summary &#128202;
      </Heading>

      <Text style={{ fontSize: 15, color: "#555", lineHeight: "1.6" }}>
        Assalamu Alaikum {name}! Here&apos;s what you created this month:
      </Text>

      <Section style={{ backgroundColor: "#e8f5ec", borderRadius: 8, padding: 20, textAlign: "center" as const, margin: "16px 0" }}>
        <Text style={{ fontSize: 40, fontWeight: 800, color: "#1a6b4a", margin: "0 0 4px" }}>
          {sheetsGenerated}
        </Text>
        <Text style={{ fontSize: 14, color: "#555", margin: 0 }}>
          activity sheets generated
        </Text>
      </Section>

      {topThemes.length > 0 && (
        <>
          <Text style={{ fontSize: 14, fontWeight: 600, color: "#333", margin: "16px 0 8px" }}>
            Your favorite themes:
          </Text>
          {topThemes.map((theme, i) => (
            <Text key={i} style={{ fontSize: 14, color: "#555", margin: "0 0 4px" }}>
              {i + 1}. {theme}
            </Text>
          ))}
        </>
      )}

      <Hr style={{ borderColor: "#e8e4dc", margin: "20px 0" }} />

      {plan === "free" ? (
        <>
          <Text style={{ fontSize: 14, color: "#555", margin: "0 0 16px" }}>
            &#128161; <strong>Tip:</strong> Upgrade to Pro for unlimited sheets, no watermarks,
            and new themes every week. Starting at just $8/month.
          </Text>
          <Section style={{ textAlign: "center" as const }}>
            <GoldButton href={`${appUrl}/dashboard`}>
              Upgrade to Pro &#8594;
            </GoldButton>
          </Section>
        </>
      ) : (
        <Section style={{ textAlign: "center" as const }}>
          <CtaButton href={`${appUrl}/dashboard`}>
            Create More Sheets &#8594;
          </CtaButton>
        </Section>
      )}
    </EmailLayout>
  );
}
