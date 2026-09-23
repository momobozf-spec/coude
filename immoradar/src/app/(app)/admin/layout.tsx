import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/tenant";
import { hasPermission } from "@/lib/auth/permissions";

/** Platform-admin area. Non-admins get a 404 so the area's existence is not confirmed. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!hasPermission(user.role, "platform:admin")) notFound();
  return <>{children}</>;
}
