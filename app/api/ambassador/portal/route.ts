import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/account";
import { prisma } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/ambassador-security";
import { addDays, ambassadorConfig } from "@/lib/ambassador-config";

export const dynamic = "force-dynamic";

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
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  if (action === "submit_content") {
    const platform = String(body.platform || "").trim();
    const contentType = String(body.contentType || "").trim();
    const captionText = String(body.captionText || "").trim();
    const publishedUrl = String(body.publishedUrl || "").trim();
    if (!platform || !contentType || (!captionText && !publishedUrl)) {
      return NextResponse.json(
        { ok: false, error: "content_fields_required" },
        { status: 400 }
      );
    }
    const previous = await prisma.ambassadorContent.count({
      where: { ambassadorId: ambassador.id }
    });
    const content = await prisma.ambassadorContent.create({
      data: {
        ambassadorId: ambassador.id,
        platform: platform.slice(0, 40),
        contentType: contentType.slice(0, 80),
        captionText: captionText.slice(0, 5000) || null,
        publishedUrl: publishedUrl.slice(0, 1000) || null,
        status: "SUBMITTED",
        isFirstContent: previous === 0,
        submittedAt: new Date()
      }
    });
    await prisma.ambassador.update({
      where: { id: ambassador.id },
      data: { lastActivityAt: new Date() }
    });
    return NextResponse.json({ ok: true, contentId: content.id });
  }
  if (action === "dispute_payout") {
    const payoutId = String(body.payoutId || "");
    const payout = await prisma.ambassadorPayout.findFirst({
      where: { id: payoutId, ambassadorId: ambassador.id }
    });
    if (!payout) {
      return NextResponse.json({ ok: false, error: "payout_not_found" }, { status: 404 });
    }
    const subject = String(body.subject || "").trim();
    const description = String(body.description || "").trim();
    if (!subject || description.length < 10) {
      return NextResponse.json(
        { ok: false, error: "dispute_fields_required" },
        { status: 400 }
      );
    }
    await prisma.ambassadorPayoutDispute.create({
      data: {
        ambassadorId: ambassador.id,
        payoutId,
        subject: subject.slice(0, 160),
        description: description.slice(0, 3000),
        orderNumber: String(body.orderNumber || "").trim().slice(0, 80) || null
      }
    });
    return NextResponse.json({ ok: true });
  }
  if (action === "request_termination") {
    if (ambassador.terminationRequestedAt) {
      return NextResponse.json({ ok: true, alreadyRequested: true });
    }
    const now = new Date();
    await prisma.ambassador.update({
      where: { id: ambassador.id },
      data: {
        terminationRequestedAt: now,
        terminationEffectiveAt: addDays(
          now,
          ambassadorConfig().terminationNoticeDays
        )
      }
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { ok: false, error: "invalid_action" },
    { status: 400 }
  );
}
