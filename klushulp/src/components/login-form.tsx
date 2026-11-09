"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button, FieldError, Input, Label } from "@/components/ui";

export function LoginForm({ labels, redirectTo }: { labels: Record<string, string>; redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await authClient.signIn.email({ email, password });
        setBusy(false);
        if (res.error) {
          setError(labels.failed);
          return;
        }
        // Rol bepaalt de landingspagina; de server stuurt beheerders door.
        router.push(redirectTo);
        router.refresh();
      }}
    >
      <div>
        <Label htmlFor="email">{labels.email}</Label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </div>
      <div>
        <Label htmlFor="password">{labels.password}</Label>
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" full disabled={busy}>
        {busy ? labels.loading : labels.submit}
      </Button>
    </form>
  );
}
