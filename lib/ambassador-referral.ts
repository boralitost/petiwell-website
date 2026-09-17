import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { addDays, ambassadorConfig } from "@/lib/ambassador-config";
import { hashPrivateValue } from "@/lib/ambassador-security";

export const AMBASSADOR_REFERRAL_COOKIE = "petiwell_ambassador_ref";
export const AMBASSADOR_VISITOR_COOKIE = "petiwell_ambassador_visitor";
export const CONSENT_COOKIE = "petiwell_consent";

function signingSecret() {
  return (
    process.env.AMBASSADOR_REFERRAL_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    ""
  );
}

function sign(value: string) {
  const secret = signingSecret();
  if (!secret) throw new Error("ambassador_referral_secret_not_configured");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function signedReferralCookie(referralId: string): string {
  return `${referralId}.${sign(referralId)}`;
}

export function verifyReferralCookie(raw: string): string | null {
  const separator = raw.lastIndexOf(".");
  if (separator < 1) return null;
  const referralId = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  let expected = "";
  try {
    expected = sign(referralId);
  } catch {
    return null;
  }
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }
  return referralId;
}

export function referralIdFromRequest(req: NextRequest): string | null {
  const raw = req.cookies.get(AMBASSADOR_REFERRAL_COOKIE)?.value || "";
  return verifyReferralCookie(raw);
}

export async function createAmbassadorReferral(input: {
  referralToken: string;
  visitorId?: string;
  source?: string;
}) {
  const ambassador = await prisma.ambassador.findFirst({
    where: {
      referralToken: input.referralToken,
      referralActive: true,
      status: {
        in: [
          "ACTIVE_PENDING_SHIPMENT",
          "ACTIVE_PENDING_FIRST_CONTENT",
          "ACTIVE"
        ]
      }
    },
    select: { id: true, referralToken: true }
  });
  if (!ambassador?.referralToken) {
    return { ok: false as const, error: "invalid_referral" };
  }
  const visitorId = input.visitorId || randomBytes(24).toString("base64url");
  const now = new Date();
  const referral = await prisma.ambassadorReferral.create({
    data: {
      ambassadorId: ambassador.id,
      anonymousVisitorHash: hashPrivateValue(visitorId),
      referralToken: ambassador.referralToken,
      source: (input.source || "link").slice(0, 80),
      clickedAt: now,
      expiresAt: addDays(now, ambassadorConfig().referralDays)
    }
  });
  return { ok: true as const, referral, visitorId };
}

export async function validReferralAttribution(referralId: string | null) {
  if (!referralId) return null;
  return prisma.ambassadorReferral.findFirst({
    where: {
      id: referralId,
      expiresAt: { gt: new Date() },
      ambassador: {
        referralActive: true,
        status: {
          in: [
            "ACTIVE_PENDING_SHIPMENT",
            "ACTIVE_PENDING_FIRST_CONTENT",
            "ACTIVE"
          ]
        }
      }
    },
    include: { ambassador: true }
  });
}
