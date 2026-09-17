import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin-auth";
import { getOperationsHealth } from "@/lib/operations-health";

export const dynamic = "force-dynamic";

export async function GET() {
  if (
    !(await requireAdminRole(["SUPER_ADMIN", "OPERATIONS", "FINANCE"]))
  ) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json(await getOperationsHealth(), {
    headers: { "Cache-Control": "private, no-store" }
  });
}
