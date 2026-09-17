import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/account";
import { prisma } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/ambassador-security";
import {
  deleteAmbassadorDocument,
  uploadPrivateAmbassadorFile
} from "@/lib/ambassador-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  }
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const ambassador = await prisma.ambassador.findUnique({
    where: { userId: user.id }
  });
  if (!ambassador) {
    return NextResponse.json({ ok: false, error: "not_ambassador" }, { status: 403 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const payoutId = String(form?.get("payoutId") || "");
  if (!(file instanceof File) || !payoutId) {
    return NextResponse.json({ ok: false, error: "invalid_document" }, { status: 400 });
  }
  const payout = await prisma.ambassadorPayout.findFirst({
    where: {
      id: payoutId,
      ambassadorId: ambassador.id,
      status: "WAITING_DOCUMENT"
    }
  });
  if (!payout) {
    return NextResponse.json({ ok: false, error: "payout_not_found" }, { status: 404 });
  }
  let uploaded: Awaited<ReturnType<typeof uploadPrivateAmbassadorFile>> | null = null;
  try {
    uploaded = await uploadPrivateAmbassadorFile({
      ambassadorId: ambassador.id,
      file,
      category: "PAYOUT_INVOICE"
    });
    await prisma.$transaction(async (tx) => {
      const document = await tx.ambassadorDocument.create({
        data: {
          ambassadorId: ambassador.id,
          documentType: "PAYOUT_INVOICE",
          ...uploaded!,
          scanStatus: "CLEAN"
        }
      });
      await tx.ambassadorPayout.update({
        where: { id: payout.id },
        data: { invoiceDocumentId: document.id }
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (uploaded?.storageKey) {
      await deleteAmbassadorDocument(uploaded.storageKey).catch(() => undefined);
    }
    const message = error instanceof Error ? error.message : "document_upload_failed";
    const safeErrors = new Set([
      "document_type_not_allowed",
      "document_size_invalid",
      "document_signature_invalid",
      "document_scanner_not_configured",
      "document_malware_detected",
      "document_scan_failed",
      "ambassador_storage_not_configured"
    ]);
    return NextResponse.json(
      {
        ok: false,
        error: safeErrors.has(message) ? message : "document_upload_failed"
      },
      { status: 400 }
    );
  }
}
