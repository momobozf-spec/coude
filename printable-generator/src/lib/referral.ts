export function generateReferralCode(userId: string): string {
  // Short, memorable code: first 4 chars of userId + random 4 chars
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = userId.slice(0, 4).toUpperCase();
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export const REFERRAL_BONUS = 5; // 5 bonus generations per successful referral
