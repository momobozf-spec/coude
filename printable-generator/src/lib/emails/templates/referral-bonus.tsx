import * as React from "react";
import { EmailLayout, CtaButton, Text, Hr, Section, Heading } from "../components";

interface Props {
  name: string;
  friendName: string;
  bonusSheets: number;
  totalBonus: number;
  appUrl: string;
}

export function ReferralBonusEmail({ name, friendName, bonusSheets, totalBonus, appUrl }: Props) {
  return (
    <EmailLayout preview={`${friendName} joined via your link! You earned ${bonusSheets} free sheets`}>
      <Section style={{ textAlign: "center" as const, marginBottom: 16 }}>
        <Text style={{ fontSize: 40, margin: 0 }}>&#127881;</Text>
      </Section>

      <Heading style={{ fontSize: 22, color: "#1a1a2e", margin: "0 0 8px", textAlign: "center" as const }}>
        Your friend joined, {name}!
      </Heading>

      <Text style={{ fontSize: 15, color: "#555", lineHeight: "1.6", textAlign: "center" as const }}>
        <strong>{friendName}</strong> just signed up using your referral link.
        You&apos;ve earned <strong style={{ color: "#1a6b4a" }}>{bonusSheets} bonus worksheets</strong>!
      </Text>

      <Hr style={{ borderColor: "#e8e4dc", margin: "20px 0" }} />

      <Section style={{ backgroundColor: "#e8f5ec", borderRadius: 8, padding: 16, textAlign: "center" as const }}>
        <Text style={{ fontSize: 28, fontWeight: 700, color: "#1a6b4a", margin: "0 0 4px" }}>
          +{bonusSheets} sheets
        </Text>
        <Text style={{ fontSize: 13, color: "#555", margin: 0 }}>
          Total bonus sheets earned: <strong>{totalBonus}</strong>
        </Text>
      </Section>

      <Text style={{ fontSize: 14, color: "#555", margin: "20px 0", textAlign: "center" as const }}>
        Keep sharing your referral link to earn more free sheets!
        Every friend who signs up gives you 5 more.
      </Text>

      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <CtaButton href={`${appUrl}/dashboard`}>
          Share More &amp; Earn More &#8594;
        </CtaButton>
      </Section>
    </EmailLayout>
  );
}
