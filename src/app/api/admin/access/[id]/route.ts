import { AdminAccessError, getCurrentAdmin, removeAdminAccess, unauthorised } from "@/lib/adminAuth.server";

export const runtime = "nodejs";

/** DELETE /api/admin/access/:id — remove someone's admin access. Never the owner's or your own. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/admin/access/[id]">) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorised();
  const { id } = await ctx.params;
  try {
    await removeAdminAccess(id, admin);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
