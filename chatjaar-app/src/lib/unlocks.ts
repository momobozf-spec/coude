import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AiResult } from "./ai-types";

/** Remembers on this phone which chats were unlocked, so re-opening the same chat doesn't need a new purchase.
 *  Stores only a fingerprint, the transaction id and the (pseudonymised) AI result — never the chat. */
export interface Unlock {
  transactionId: string;
  appUserId: string;
  ai?: AiResult;
}

const key = (fingerprint: string) => `chatjaar:unlock:v1:${fingerprint}`;

export async function loadUnlock(fingerprint: string): Promise<Unlock | null> {
  try {
    const raw = await AsyncStorage.getItem(key(fingerprint));
    return raw ? (JSON.parse(raw) as Unlock) : null;
  } catch {
    return null;
  }
}

export async function saveUnlock(fingerprint: string, unlock: Unlock): Promise<void> {
  try {
    await AsyncStorage.setItem(key(fingerprint), JSON.stringify(unlock));
  } catch {
    // Best effort: the purchase itself is still valid at RevenueCat.
  }
}
