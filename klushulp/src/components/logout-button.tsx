"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LogoutButton({ label, redirectTo }: { label: string; redirectTo: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-lg px-3 py-2 text-muted hover:bg-brand-soft hover:text-brand-strong"
      onClick={async () => {
        await authClient.signOut();
        router.push(redirectTo);
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
