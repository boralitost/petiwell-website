import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  documentTypeFromRaw,
  getValidAmbassadorInvite
} from "@/lib/ambassador";
import { isSameOriginRequest } from "@/lib/ambassador-security";
import {
  deleteAmbassadorDocument,
  uploadPrivateAmbassadorFile
} from "@/lib/ambassador-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, props: Context) {
  const params = await props.params;
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  }
  const invite = await getValidAmbassadorInvite(params.token);
  const ambassador = invite?.ambassador;
  if (!ambassador) {
    return NextResponse.json({ ok: false, error: "profile_required" }, { status: 409 });
  }
  if (!["ONBOARDING", "MISSING_DOCUMENTS"].includes(ambassador.status)) {
    return NextResponse.json(
      { ok: false, error: "onboarding_locked" },
      { status: 409 }
    );
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const documentType = documentTypeFromRaw(String(form?.get("documentType") || ""));
  if (!(file instanceof File) || !documentType) {
    return NextResponse.json(
      { ok: false, error: "invalid_document" },
      { status: 400 }
    );
  }
  let uploaded: Awaited<ReturnType<typeof uploadPrivateAmbassadorFile>> | null = null;
  try {
    uploaded = await uploadPrivateAmbassadorFile({
      ambassadorId: ambassador.id,
      file,
      category: documentType
    });
    const document = await prisma.ambassadorDocument.create({
      data: {
        ambassadorId: ambassador.id,
        documentType,
        ...uploaded,
        scanStatus: "CLEAN"
      }
    });
    return NextResponse.json({
      ok: true,
      document: {
        id: document.id,
        documentType: document.documentType,
        originalName: document.originalName,
        status: document.status,
        uploadedAt: document.uploadedAt
      }
    });
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
