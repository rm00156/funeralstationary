import AdminAccessManager from "@/components/AdminAccessManager";
import { listAdmins, requireAdmin } from "@/lib/adminAuth.server";

export const dynamic = "force-dynamic";

export default async function AdminAccessPage() {
  const [me, admins] = await Promise.all([requireAdmin(), listAdmins()]);

  return (
    <>
      <h1 className="mb-2 font-display text-3xl font-medium text-primary">Access</h1>
      <p className="mb-8 max-w-2xl font-body text-on-surface-variant">
        Everyone who can sign in to this admin area. There are no passwords: add someone&rsquo;s email
        and we&rsquo;ll send them an invitation, then they sign in with a link emailed to that address.
        Removing someone signs them out straight away.
      </p>
      <AdminAccessManager
        currentEmail={me.email}
        admins={admins.map((admin) => ({
          ...admin,
          lastSignInAt: admin.lastSignInAt?.toISOString() ?? null,
          createdAt: admin.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
