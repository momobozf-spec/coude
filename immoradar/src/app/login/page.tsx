import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.agencyId ? "/" : "/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-3xl font-bold tracking-tight text-white">
            Immo<span className="text-indigo-400">Radar</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">Real Estate Acquisition Intelligence</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-xl">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Demo: thomas@immo-vandenberghe.be / demo1234
        </p>
      </div>
    </main>
  );
}
