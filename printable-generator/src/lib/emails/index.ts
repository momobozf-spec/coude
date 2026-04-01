import { sendEmail } from "./send";
import { WelcomeEmail } from "./templates/welcome";
import { UpgradeConfirmationEmail } from "./templates/upgrade-confirmation";
import { ReferralBonusEmail } from "./templates/referral-bonus";
import { MonthlyDigestEmail } from "./templates/monthly-digest";
import { RamadanCampaignEmail } from "./templates/ramadan-campaign";
import { ReEngagementEmail } from "./templates/re-engagement";
import { CommunityWelcomeEmail } from "./templates/community-welcome";
import React from "react";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://noorprintables.com";

export async function sendWelcomeEmail(to: string, name: string) {
  return sendEmail({
    to,
    subject: `Assalamu Alaikum ${name}! Welcome to Noor Printables 🌙`,
    react: React.createElement(WelcomeEmail, { name, appUrl: APP_URL }),
  });
}

export async function sendUpgradeEmail(
  to: string,
  name: string,
  plan: "pro" | "school",
  amount: string,
  period: string
) {
  const planName = plan === "school" ? "School" : "Pro";
  return sendEmail({
    to,
    subject: `Your Noor Printables ${planName} subscription is active! ⭐`,
    react: React.createElement(UpgradeConfirmationEmail, { name, plan, amount, period, appUrl: APP_URL }),
  });
}

export async function sendReferralBonusEmail(
  to: string,
  name: string,
  friendName: string,
  bonusSheets: number,
  totalBonus: number
) {
  return sendEmail({
    to,
    subject: `${friendName} joined! You earned ${bonusSheets} free worksheets 🎉`,
    react: React.createElement(ReferralBonusEmail, { name, friendName, bonusSheets, totalBonus, appUrl: APP_URL }),
  });
}

export async function sendMonthlyDigestEmail(
  to: string,
  name: string,
  sheetsGenerated: number,
  topThemes: string[],
  plan: string
) {
  return sendEmail({
    to,
    subject: `Your month in review: ${sheetsGenerated} sheets created! 📊`,
    react: React.createElement(MonthlyDigestEmail, { name, sheetsGenerated, topThemes, plan, appUrl: APP_URL }),
  });
}

export async function sendRamadanCampaignEmail(
  to: string,
  name: string,
  discountCode: string,
  discountPercent: number,
  expiresDate: string
) {
  return sendEmail({
    to,
    subject: `Ramadan Mubarak! ${discountPercent}% off Noor Printables this week 🌙⭐`,
    react: React.createElement(RamadanCampaignEmail, { name, discountCode, discountPercent, expiresDate, appUrl: APP_URL }),
  });
}

export async function sendReEngagementEmail(
  to: string,
  name: string,
  daysSinceActive: number,
  plan: string
) {
  return sendEmail({
    to,
    subject: `We miss you, ${name}! New Islamic worksheets waiting 💛`,
    react: React.createElement(ReEngagementEmail, { name, daysSinceActive, plan, appUrl: APP_URL }),
  });
}

export async function sendCommunityWelcomeEmail(
  to: string,
  name: string,
  plan: string,
  communityUrl: string
) {
  return sendEmail({
    to,
    subject: `Welcome to Noor Families! 🌟 Your community is waiting`,
    react: React.createElement(CommunityWelcomeEmail, { name, plan, communityUrl }),
  });
}
