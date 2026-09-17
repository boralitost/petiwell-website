import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/account";
import { prisma } from "@/lib/db";
import { isLocale } from "@/lib/i18n";
import { AmbassadorDashboard } from "@/components/ambassador/AmbassadorDashboard";

export const dynamic = "force-dynamic";

export default async function AmbassadorPanelPage(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;
  const locale = isLocale(params.locale) ? params.locale : "tr";
  const user = await getCurrentUser();
  if (!user) {
    return (
      <main className="section-shell mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-semibold">Marka Elçisi Paneli</h1>
        <p className="mt-3 text-sm text-muted">
          Paneli açmak için Petiwell hesabınla giriş yap.
        </p>
        <Link
          href={`/${locale}/account/login`}
          className="mt-5 inline-flex rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white"
        >
          Giriş Yap
        </Link>
      </main>
    );
  }
  const ambassador = await prisma.ambassador.findUnique({
    where: { userId: user.id },
    include: {
      coupons: { where: { active: true }, take: 1 },
      commissions: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          commissionAmount: true,
          status: true,
          createdAt: true,
          order: {
            select: {
              orderNumber: true,
              createdAt: true,
              status: true,
              productTotalAfterDiscountTry: true
            }
          }
        }
      },
      payouts: {
        orderBy: { createdAt: "desc" },
        take: 24,
        include: { disputes: { orderBy: { createdAt: "desc" } } }
      },
      contents: { orderBy: { createdAt: "desc" }, take: 50 },
      shipments: { orderBy: { createdAt: "desc" }, take: 10 }
    }
  });
  if (!ambassador) redirect(`/${locale}/account`);
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://petiwell.com"
  ).replace(/\/+$/, "");
  return (
    <AmbassadorDashboard
      ambassador={{
        publicId: ambassador.publicId,
        firstName: ambassador.firstName,
        status: ambassador.status,
        couponCode: ambassador.coupons[0]?.code || "",
        referralUrl: ambassador.referralToken
          ? `${origin}/r/${ambassador.referralToken}`
          : "",
        firstContentDueAt: ambassador.firstContentDueAt?.toISOString() || null,
        terminationRequestedAt:
          ambassador.terminationRequestedAt?.toISOString() || null,
        terminationEffectiveAt:
          ambassador.terminationEffectiveAt?.toISOString() || null
      }}
      commissions={ambassador.commissions.map((commission) => ({
        id: commission.id,
        amount: Number(commission.commissionAmount),
        status: commission.status,
        createdAt: commission.createdAt.toISOString(),
        orderNumber: commission.order.orderNumber,
        orderDate: commission.order.createdAt.toISOString(),
        orderStatus: commission.order.status,
        productTotal: Number(
          commission.order.productTotalAfterDiscountTry
        )
      }))}
      payouts={ambassador.payouts.map((payout) => ({
        id: payout.id,
        periodStart: payout.periodStart.toISOString(),
        periodEnd: payout.periodEnd.toISOString(),
        netPayout: Number(payout.netPayout),
        status: payout.status,
        paidAt: payout.paidAt?.toISOString() || null,
        disputes: payout.disputes.map((dispute) => ({
          id: dispute.id,
          subject: dispute.subject,
          createdAt: dispute.createdAt.toISOString(),
          resolvedAt: dispute.resolvedAt?.toISOString() || null
        }))
      }))}
      contents={ambassador.contents.map((content) => ({
        id: content.id,
        platform: content.platform,
        contentType: content.contentType,
        publishedUrl: content.publishedUrl,
        status: content.status,
        reviewNotes: content.reviewNotes,
        createdAt: content.createdAt.toISOString()
      }))}
      shipments={ambassador.shipments.map((shipment) => ({
        id: shipment.id,
        status: shipment.status,
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        shippedAt: shipment.shippedAt?.toISOString() || null
      }))}
    />
  );
}
