import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";
import { getValidAmbassadorInvite } from "@/lib/ambassador";
import { AMBASSADOR_LEGAL_DOCUMENTS } from "@/lib/ambassador-documents";
import { AmbassadorOnboarding } from "@/components/ambassador/AmbassadorOnboarding";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string; token: string }>;
};

export const metadata: Metadata = {
  title: "Petiwell Marka Elçisi Onboarding",
  robots: { index: false, follow: false },
  referrer: "no-referrer"
};

export default async function AmbassadorOnboardingPage(props: Props) {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const invite = await getValidAmbassadorInvite(params.token);
  if (!invite) notFound();
  return (
    <AmbassadorOnboarding
      locale={locale}
      token={params.token}
      invite={{
        firstName: invite.firstName,
        lastName: invite.lastName,
        email: invite.email || "",
        socialHandle: invite.socialHandle,
        expiresAt: invite.expiresAt.toISOString()
      }}
      initial={
        invite.ambassador
          ? {
              firstName: invite.ambassador.firstName,
              lastName: invite.ambassador.lastName,
              birthDate: invite.ambassador.birthDate.toISOString().slice(0, 10),
              email: invite.ambassador.email,
              emailVerified: Boolean(invite.ambassador.emailVerifiedAt),
              phone: invite.ambassador.phone,
              shippingAddress: invite.ambassador.shippingAddress,
              city: invite.ambassador.city,
              district: invite.ambassador.district,
              postalCode: invite.ambassador.postalCode,
              primarySocialPlatform: invite.ambassador.primarySocialPlatform,
              instagramUsername: invite.ambassador.instagramUsername,
              tiktokUsername: invite.ambassador.tiktokUsername,
              youtubeUsername: invite.ambassador.youtubeUsername,
              otherSocialUrl: invite.ambassador.otherSocialUrl,
              taxType: invite.ambassador.taxType || "",
              taxIdLast4: invite.ambassador.taxIdLast4 || "",
              ibanLast4: invite.ambassador.ibanLast4 || "",
              ibanHolderName: invite.ambassador.ibanHolderName || "",
              bankOwnershipConfirmed: Boolean(
                invite.ambassador.bankOwnershipConfirmedAt
              ),
              hasTaxDocument: invite.ambassador.documents.some((document) =>
                ["TAX_20B", "TAX_CERTIFICATE"].includes(document.documentType)
              ),
              status: invite.ambassador.status
            }
          : null
      }
      documents={AMBASSADOR_LEGAL_DOCUMENTS.map((document) => ({
        type: document.type,
        title: document.title,
        version: document.version,
        action: document.action,
        body: document.body
      }))}
    />
  );
}
