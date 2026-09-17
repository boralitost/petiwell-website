import { NextRequest, NextResponse } from "next/server";
import {
  AMBASSADOR_REFERRAL_COOKIE,
  AMBASSADOR_VISITOR_COOKIE,
  CONSENT_COOKIE,
  createAmbassadorReferral,
  signedReferralCookie
} from "@/lib/ambassador-referral";
import { isSameOriginRequest } from "@/lib/ambassador-security";
import { ambassadorConfig } from "@/lib/ambassador-config";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const consentAccepted =
    req.cookies.get(CONSENT_COOKIE)?.value === "accepted" ||
    body.consentAccepted === true;
  if (!consentAccepted) {
    return NextResponse.json(
      { ok: false, error: "consent_required" },
      { status: 409 }
    );
  }
  const referralToken = String(body.referralToken || "").trim();
  const visitorId = req.cookies.get(AMBASSADOR_VISITOR_COOKIE)?.value;
  const result = await createAmbassadorReferral({
    referralToken,
    visitorId,
    source: String(body.source || "link")
  });
  if (!result.ok) {
    return NextResponse.json(result, { status: 404 });
  }
  const maxAge = ambassadorConfig().referralDays * 24 * 60 * 60;
  const response = NextResponse.json({ ok: true });
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  };
  response.cookies.set(
    AMBASSADOR_REFERRAL_COOKIE,
    signedReferralCookie(result.referral.id),
    cookieOptions
  );
  response.cookies.set(
    AMBASSADOR_VISITOR_COOKIE,
    result.visitorId,
    cookieOptions
  );
  response.cookies.set(CONSENT_COOKIE, "accepted", {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60
  });
  return response;
}

export async function DELETE(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AMBASSADOR_REFERRAL_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  response.cookies.set(AMBASSADOR_VISITOR_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
