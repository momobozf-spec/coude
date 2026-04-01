import * as React from "react";
import { EmailLayout, CtaButton, Text, Hr, Section, Heading } from "../components";

interface Props {
  name: string;
  appUrl: string;
}

export function WelcomeEmail({ name, appUrl }: Props) {
  return (
    <EmailLayout preview={`Assalamu Alaikum ${name}! Welcome to Noor Printables`}>
      <Heading style={{ fontSize: 22, color: "#1a1a2e", margin: "0 0 8px" }}>
        Assalamu Alaikum, {name}! &#127769;
      </Heading>
      <Text style={{ fontSize: 15, color: "#555", lineHeight: "1.6" }}>
        JazakAllahu Khairan for joining Noor Printables — the platform where Muslim parents
        and teachers create beautiful Islamic educational activities for children.
      </Text>

      <Hr style={{ borderColor: "#e8e4dc", margin: "20px 0" }} />

      <Text style={{ fontSize: 14, fontWeight: 600, color: "#1a6b4a", margin: "0 0 12px" }}>
        Here&apos;s what you can do right now:
      </Text>

      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 8px" }}>
        &#127912; <strong>Generate printable coloring pages</strong> — Mosques, crescents, Islamic patterns
      </Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 8px" }}>
        &#128300; <strong>Create mazes</strong> — Help find the path to the mosque or iftar table
      </Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 8px" }}>
        &#128260; <strong>Word searches</strong> — Islamic vocabulary: Salah, Quran, Sabr...
      </Text>
      <Text style={{ fontSize: 14, color: "#555", margin: "0 0 8px" }}>
        &#127912; <strong>Digital coloring</strong> — Color on phone, tablet or laptop
      </Text>

      <Section style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <CtaButton href={`${appUrl}/dashboard`}>
          Start Creating &#8594;
        </CtaButton>
      </Section>

      <Text style={{ fontSize: 13, color: "#999" }}>
        You have <strong>3 free sheets</strong> to try. Love it? Upgrade to Pro for unlimited access.
      </Text>

      <Hr style={{ borderColor: "#e8e4dc", margin: "20px 0" }} />

      <Text style={{ fontSize: 13, color: "#999" }}>
        &#128172; <strong>Invite friends</strong> and earn 5 bonus worksheets for each signup.
        Share your link from the dashboard!
      </Text>
    </EmailLayout>
  );
}
