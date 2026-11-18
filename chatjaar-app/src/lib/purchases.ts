import Purchases, { PRODUCT_CATEGORY, type PurchasesStoreProduct } from "react-native-purchases";
import { config, paymentsConfigured } from "./config";

let configured = false;

export function initPurchases() {
  if (configured || !paymentsConfigured()) return;
  try {
    Purchases.configure({ apiKey: config.revenueCatKey });
    configured = true;
  } catch (err) {
    console.warn("purchases_configure_failed", err);
  }
}

export async function getUnlockProduct(): Promise<PurchasesStoreProduct | null> {
  if (!configured) return null;
  try {
    const products = await Purchases.getProducts([config.unlockProductId], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    return products[0] ?? null;
  } catch (err) {
    console.warn("get_products_failed", err);
    return null;
  }
}

export type BuyResult =
  | { ok: true; transactionId: string; appUserId: string }
  | { ok: false; cancelled: boolean };

/** Buys the consumable unlock. The server verifies the transaction with RevenueCat before running the AI. */
export async function buyUnlock(product: PurchasesStoreProduct): Promise<BuyResult> {
  try {
    const result = await Purchases.purchaseStoreProduct(product);
    const appUserId = await Purchases.getAppUserID();
    return { ok: true, transactionId: result.transaction.transactionIdentifier, appUserId };
  } catch (err) {
    const cancelled = Boolean((err as { userCancelled?: boolean | null })?.userCancelled);
    if (!cancelled) console.warn("purchase_failed", err);
    return { ok: false, cancelled };
  }
}
