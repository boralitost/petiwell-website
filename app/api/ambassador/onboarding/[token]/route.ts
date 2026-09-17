import { NextRequest, NextResponse } from "next/server";
import type {
  AmbassadorConsentType,
  AmbassadorTaxType
} from "@prisma/client";
import {
  getValidAmbassadorInvite,
  requestAmbassadorEmailCode,
  requestIp,
  saveAmbassadorProfile,
  saveAmbassadorTax,
  submitAmbassadorOnboarding,
  verifyAmbassadorEmailCode
} from "@/lib/ambassador";
import { isSameOriginRequest } from "@/lib/ambassador-security";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

function errorStatus(error: string) {
  if (error === "invalid_invite") return 404;
  if (error === "onboarding_locked") return 409;
  if (
    error === "profile_required" ||
    error === "email_not_verified" ||
    error === "tax_required" ||
    error === "tax_document_required" ||
    error === "consents_required"
  ) {
    return 409;
  }
  return 400;
}

export async function GET(_req: NextRequest, props: Context) {
  const params = await props.params;
  const invite = await getValidAmbassadorInvite(params.token);
  if (!invite) {
    return NextResponse.json({ ok: false, error: "invalid_invite" }, { status: 404 });
  }
  const ambassador = invite.ambassador;
  return NextResponse.json({
    ok: true,
    invite: {
      firstName: invite.firstName,
      lastName: invite.lastName,
      email: invite.email || "",
      socialHandle: invite.socialHandle,
      expiresAt: invite.expiresAt
    },
    application: ambassador
      ? {
          firstName: ambassador.firstName,
          lastName: ambassador.lastName,
          email: ambassador.email,
          emailVerified: Boolean(ambassador.emailVerifiedAt),
          phone: ambassador.phone,
          birthDate: ambassador.birthDate.toISOString().slice(0, 10),
          shippingAddress: ambassador.shippingAddress,
          city: ambassador.city,
          district: ambassador.district,
          postalCode: ambassador.postalCode,
          primarySocialPlatform: ambassador.primarySocialPlatform,
          instagramUsername: ambassador.instagramUsername,
          tiktokUsername: ambassador.tiktokUsername,
          youtubeUsername: ambassador.youtubeUsername,
          otherSocialUrl: ambassador.otherSocialUrl,
          taxType: ambassador.taxType,
          taxIdLast4: ambassador.taxIdLast4,
          ibanLast4: ambassador.ibanLast4,
          ibanHolderName: ambassador.ibanHolderName,
          bankOwnershipConfirmed: Boolean(ambassador.bankOwnershipConfirmedAt),
          step: ambassador.onboardingStep,
          status: ambassador.status
        }
      : null
  });
}

export async function PATCH(req: NextRequest, props: Context) {
  const params = await props.params;
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const result =
    action === "profile"
      ? await saveAmbassadorProfile(params.token, {
          firstName: String(body.firstName || ""),
          lastName: String(body.lastName || ""),
          birthDate: String(body.birthDate || ""),
          email: String(body.email || ""),
          phone: String(body.phone || ""),
          shippingAddress: String(body.shippingAddress || ""),
          city: String(body.city || ""),
          district: String(body.district || ""),
          postalCode: String(body.postalCode || ""),
          primarySocialPlatform: String(body.primarySocialPlatform || ""),
          instagramUsername: String(body.instagramUsername || ""),
          tiktokUsername: String(body.tiktokUsername || ""),
          youtubeUsername: String(body.youtubeUsername || ""),
          otherSocialUrl: String(body.otherSocialUrl || "")
        })
      : action === "tax"
        ? await saveAmbassadorTax(params.token, {
            taxType: String(body.taxType || "") as AmbassadorTaxType,
            taxId: String(body.taxId || ""),
            taxOffice: String(body.taxOffice || ""),
            businessName: String(body.businessName || ""),
            invoiceAddress: String(body.invoiceAddress || ""),
            iban: String(body.iban || ""),
            ibanHolderName: String(body.ibanHolderName || ""),
            bankOwnershipConfirmed: body.bankOwnershipConfirmed === true
          })
        : { ok: false as const, error: "invalid_action" };
  if (!result.ok) {
    return NextResponse.json(result, { status: errorStatus(result.error) });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, props: Context) {
  const params = await props.params;
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  if (action === "send_code") {
    const result = await requestAmbassadorEmailCode(params.token);
    return NextResponse.json(result, {
      status: result.ok ? 200 : errorStatus(result.error)
    });
  }
  if (action === "verify_code") {
    const result = await verifyAmbassadorEmailCode(
      params.token,
      String(body.code || "")
    );
    return NextResponse.json(result, {
      status: result.ok ? 200 : errorStatus(result.error)
    });
  }
  if (action === "submit") {
    const types = Array.isArray(body.acceptedTypes)
      ? body.acceptedTypes.map(String)
      : [];
    const result = await submitAmbassadorOnboarding({
      rawToken: params.token,
      acceptedTypes: types as AmbassadorConsentType[],
      ipAddress: requestIp(req.headers),
      userAgent: req.headers.get("user-agent") || ""
    });
    return NextResponse.json(result, {
      status: result.ok ? 200 : errorStatus(result.error)
    });
  }
  return NextResponse.json(
    { ok: false, error: "invalid_action" },
    { status: 400 }
  );
}
