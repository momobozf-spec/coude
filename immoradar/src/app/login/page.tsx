import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-600 text-xl font-bold text-white">IR</div>
          <h1 className="text-2xl font-semibold text-white">ImmoRadar</h1>
          <p className="mt-1 text-sm text-ink-400">Real Estate Acquisition Intelligence</p>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-ink-500">Demo accounts are listed in the README (password: immoradar).</p>
      </div>
    </main>
  );
}
