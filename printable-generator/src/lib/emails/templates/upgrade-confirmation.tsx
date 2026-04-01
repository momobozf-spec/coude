import * as React from "react";
import { EmailLayout, CtaButton, Text, Hr, Section, Heading } from "../components";

interface Props {
  name: string;
  plan: "pro" | "school";
  amount: string;
  period: string;
  appUrl: string;
}

export function UpgradeConfirmationEmail({ name, plan, amount, period, appUrl }: Props) {
  const planName = plan === "school" ? "School" : "Pro";

  return (
    <EmailLayout preview={`Your Noor Printables ${planName} subscription is active!`}>
      <Section style={{ textAlign: "center" as const, marginBottom: 16 }}>
        <Text style={{ fontSize: 40, margin: 0 }}>&#127775;</Text>
      </Section>

      <Heading style={{ fontSize: 22, color: "#1a1a2e", margin: "0 0 8px", textAlign: "center" as const }}>
        Welcome to {planName}, {name}!
      </Heading>

      <Text style={{ fontSize: 15, color: "#555", lineHeight: "1.6", textAlign: "center" as const }}>
        Your subscription is now active. You have unlimited access to all Islamic educational activities.
      </Text>

      <Hr style={{ borderColor: "#e8e4dc", margin: "20px 0" }} />

      {/* Receipt */}
      <Section style={{ backgroundColor: "#faf9f5", borderRadius: 8, padding: 16, margin: "0 0 20px" }}>
        <Text style={{ fontSize: 13, color: "#999", margin: "0 0 8px" }}>RECEIPT</Text>
        <Text style={{ fontSize: 14, color: "#333", margin: "0 0 4px" }}>
          <strong>Plan:</strong> Noor Printables {planName}
        </Text>
        <Text style={{ fontSize: 14, color: "#333", margin: "0 0 4px" }}>
          <strong>Amount:</strong> {amount}
        </Text>
        <Text style={{ fontSize: 14, color: "#333", margin: "0 0 4px" }}>
          <strong>Billing:</strong> {period}
        </Text>
        <Text style={{ fontSize: 12, color: "#999", margin: "8px 0 0" }}>
          Manage your subscription anytime from your dashboard.
        </Text>
      </Section>

      <Text style={{ fontSize: 14, fontWeight: 600, color: "#1a6b4a", margin: "0 0 8px" }}>
        What&apos;s unlocked:
      </Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 6px" }}>&#10003; Unlimited printable sheets</Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 6px" }}>&#10003; All digital coloring templates</Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 6px" }}>&#10003; No watermarks</Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 6px" }}>&#10003; Priority new themes</Text>
      {plan === "school" && (
        <>
          <Text style={{ fontSize: 14, color: "#555", margin: "0 0 6px" }}>&#10003; Up to 25 teacher accounts</Text>
          <Text style={{ fontSize: 14, color: "#555", margin: "0 0 6px" }}>&#10003; Custom school branding</Text>
        </>
      )}

      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <CtaButton href={`${appUrl}/dashboard`}>
          Go to Dashboard &#8594;
        </CtaButton>
      </Section>
    </EmailLayout>
  );
}
