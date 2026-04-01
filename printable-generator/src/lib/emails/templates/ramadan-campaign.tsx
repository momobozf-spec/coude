import * as React from "react";
import { EmailLayout, GoldButton, Text, Hr, Section, Heading } from "../components";

interface Props {
  name: string;
  discountCode: string;
  discountPercent: number;
  expiresDate: string;
  appUrl: string;
}

export function RamadanCampaignEmail({ name, discountCode, discountPercent, expiresDate, appUrl }: Props) {
  return (
    <EmailLayout preview={`Ramadan Mubarak! ${discountPercent}% off Noor Printables Pro this week only`}>
      {/* Islamic header */}
      <Section style={{ textAlign: "center" as const, marginBottom: 16 }}>
        <Text style={{ fontSize: 48, margin: 0 }}>&#127769;&#11088;</Text>
      </Section>

      <Heading style={{
        fontSize: 26, color: "#1a1a2e", margin: "0 0 8px", textAlign: "center" as const,
        fontFamily: "'Georgia', serif",
      }}>
        Ramadan Mubarak, {name}!
      </Heading>

      <Text style={{ fontSize: 15, color: "#555", lineHeight: "1.6", textAlign: "center" as const }}>
        This blessed month, make learning fun for your children with Islamic
        coloring pages, mazes, and word searches themed around Ramadan.
      </Text>

      <Hr style={{ borderColor: "#c9920a", margin: "24px 0", opacity: 0.3 }} />

      {/* Discount box */}
      <Section style={{
        background: "linear-gradient(135deg, #fdf3d7, #fef9ea)",
        borderRadius: 12,
        padding: 24,
        textAlign: "center" as const,
        border: "2px solid #c9920a",
        margin: "0 0 24px",
      }}>
        <Text style={{ fontSize: 14, color: "#a07608", fontWeight: 600, margin: "0 0 4px", letterSpacing: 1 }}>
          RAMADAN SPECIAL
        </Text>
        <Text style={{ fontSize: 42, fontWeight: 800, color: "#c9920a", margin: "0 0 4px" }}>
          {discountPercent}% OFF
        </Text>
        <Text style={{ fontSize: 15, color: "#333", margin: "0 0 12px" }}>
          Pro Plan — Unlimited Islamic worksheets
        </Text>
        <Section style={{
          backgroundColor: "#fff",
          borderRadius: 8,
          padding: "8px 16px",
          display: "inline-block" as unknown as undefined,
        }}>
          <Text style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: "#c9920a", margin: 0 }}>
            {discountCode}
          </Text>
        </Section>
        <Text style={{ fontSize: 12, color: "#999", margin: "12px 0 0" }}>
          Valid until {expiresDate} &middot; Apply at checkout
        </Text>
      </Section>

      <Text style={{ fontSize: 14, fontWeight: 600, color: "#333", margin: "0 0 8px" }}>
        Ramadan theme ideas for your kids:
      </Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 6px" }}>&#127769; Ramadan Moon &amp; Lanterns coloring</Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 6px" }}>&#128300; "Find the path to Iftar" maze</Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 6px" }}>&#128260; Ramadan vocabulary word search</Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 6px" }}>&#127912; Digital coloring on tablet during Taraweeh breaks</Text>

      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <GoldButton href={`${appUrl}/dashboard`}>
          Claim {discountPercent}% Off Now &#8594;
        </GoldButton>
      </Section>

      <Text style={{ fontSize: 12, color: "#999", textAlign: "center" as const }}>
        May this Ramadan be filled with barakah for your family.
      </Text>
    </EmailLayout>
  );
}
