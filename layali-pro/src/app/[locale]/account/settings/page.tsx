import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getLocale, getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/${await getLocale()}/login`);
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold tracking-tight mb-2 font-[family-name:var(--font-heading)]">{t("changeTitle")}</h1>
      <p className="mb-8 text-muted-foreground">{session.user.email}</p>
      <ChangePasswordForm />
    </div>
  );
}
