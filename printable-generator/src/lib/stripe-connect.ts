import { stripe } from "./stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const COMMISSION_RATE = 0.30; // 30% Noor commission

export function calculateSplit(price: number) {
  const noorAmount = Math.round(price * COMMISSION_RATE * 100) / 100;
  const sellerAmount = Math.round((price - noorAmount) * 100) / 100;
  return { sellerAmount, noorAmount };
}

export async function createConnectAccount(email: string, sellerId: string): Promise<string> {
  const account = await stripe.accounts.create({
    type: "express",
    email,
    metadata: { sellerId },
    capabilities: {
      transfers: { requested: true },
    },
  });
  return account.id;
}

export async function createOnboardingLink(accountId: string): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}/sell/dashboard?stripe_refresh=true`,
    return_url: `${APP_URL}/sell/dashboard?stripe_connected=true`,
    type: "account_onboarding",
  });
  return link.url;
}

export async function createTransfer(
  amount: number,
  accountId: string,
  description: string
): Promise<string> {
  const transfer = await stripe.transfers.create({
    amount: Math.round(amount * 100), // cents
    currency: "usd",
    destination: accountId,
    description,
  });
  return transfer.id;
}

export async function getAccountStatus(accountId: string) {
  const account = await stripe.accounts.retrieve(accountId);
  return {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  };
}

export { COMMISSION_RATE };
