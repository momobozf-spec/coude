import * as React from "react";
import { EmailLayout, CtaButton, GoldButton, Text, Hr, Section, Heading } from "../components";

interface Props {
  name: string;
  daysSinceActive: number;
  plan: string;
  appUrl: string;
}

export function ReEngagementEmail({ name, daysSinceActive, plan, appUrl }: Props) {
  return (
    <EmailLayout preview={`We miss you, ${name}! Your kids' Islamic worksheets are waiting`}>
      <Heading style={{ fontSize: 22, color: "#1a1a2e", margin: "0 0 8px" }}>
        We miss you, {name}! &#128155;
      </Heading>

      <Text style={{ fontSize: 15, color: "#555", lineHeight: "1.6" }}>
        It&apos;s been {daysSinceActive} days since your last visit. Your children&apos;s
        Islamic learning activities are waiting!
      </Text>

      <Hr style={{ borderColor: "#e8e4dc", margin: "20px 0" }} />

      <Text style={{ fontSize: 14, fontWeight: 600, color: "#1a6b4a", margin: "0 0 12px" }}>
        New since you left:
      </Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 8px" }}>
        &#127775; New Eid al-Adha coloring templates
      </Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 8px" }}>
        &#128300; Improved maze generation — more fun paths!
      </Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 8px" }}>
        &#128260; Arabic alphabet word search pack
      </Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 8px" }}>
        &#127912; 4 new digital coloring templates
      </Text>

      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <CtaButton href={`${appUrl}/dashboard`}>
          Come Back &amp; Create &#8594;
        </CtaButton>
      </Section>

      {plan === "free" && (
        <>
          <Hr style={{ borderColor: "#e8e4dc", margin: "20px 0" }} />
          <Text style={{ fontSize: 14, color: "#555", margin: "0 0 16px", textAlign: "center" as const }}>
            &#128161; Still on the free plan? Unlock unlimited sheets:
          </Text>
          <Section style={{ textAlign: "center" as const }}>
            <GoldButton href={`${appUrl}/dashboard`}>
              Upgrade to Pro — $8/month &#8594;
            </GoldButton>
          </Section>
        </>
      )}
    </EmailLayout>
  );
}
