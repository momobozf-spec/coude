import { Platform } from "react-native";

/** All values come from EXPO_PUBLIC_* variables (see .env.example). None of them are secret. */
export const config = {
  /** Base URL of the chatjaar website/backend that generates the AI slides, e.g. https://chatjaar.com */
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, ""),
  /** RevenueCat public SDK keys (appl_... / goog_...). */
  revenueCatKey: Platform.select({
    ios: process.env.EXPO_PUBLIC_RC_IOS_KEY,
    android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY,
  }) ?? "",
  /** Consumable in-app product, same id in App Store Connect and Google Play. */
  unlockProductId: process.env.EXPO_PUBLIC_UNLOCK_PRODUCT_ID || "chatjaar_unlock",
  /** Website pages for privacy, terms and imprint. */
  siteUrl: (process.env.EXPO_PUBLIC_SITE_URL || process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, ""),
};

export const paymentsConfigured = () => Boolean(config.revenueCatKey && config.apiUrl);
