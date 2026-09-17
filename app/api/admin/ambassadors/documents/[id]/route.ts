import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { auditAdminAction, requestIp } from "@/lib/ambassador";
import { signedAmbassadorDocumentUrl } from "@/lib/ambassador-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (
    !(await requireAdminRole([
      "SUPER_ADMIN",
      "OPERATIONS",
      "FINANCE",
      "CONTENT_REVIEW"
    ]))
  ) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const document = await prisma.ambassadorDocument.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      ambassadorId: true,
      storageKey: true
    }
  });
  if (!document) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const url = await signedAmbassadorDocumentUrl(document.storageKey, 180);
  await auditAdminAction({
    action: "AMBASSADOR_DOCUMENT_VIEWED",
    entityType: "AmbassadorDocument",
    entityId: document.id,
    ambassadorId: document.ambassadorId,
    ipAddress: requestIp(req.headers)
  });
  return NextResponse.redirect(url);
}
