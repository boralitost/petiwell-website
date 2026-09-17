import { adminConfigured, getAdminPrincipal } from "@/lib/admin-auth";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { AdminOrders } from "@/components/admin/AdminOrders";
import { AdminInventory } from "@/components/admin/AdminInventory";
import { AdminReadiness } from "@/components/admin/AdminReadiness";
import { AdminAmbassadors } from "@/components/admin/AdminAmbassadors";
import { prisma } from "@/lib/db";
import { ensureInventorySeeded } from "@/lib/inventory";
import { getCatalogProduct } from "@/lib/product";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!adminConfigured()) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="mt-3 text-sm text-neutral-600">
          ADMIN_PASSWORD ve ADMIN_SESSION_SECRET env değişkenlerini ayarlayın.
        </p>
      </main>
    );
  }

  const principal = await getAdminPrincipal();
  if (!principal) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-semibold">Petiwell Admin</h1>
        <AdminLoginForm />
      </main>
    );
  }

  let orders: Parameters<typeof AdminOrders>[0]["orders"] = [];
  let inventory: {
    productId: string;
    sku: string;
    stock: number;
    name: string;
    priceTry: number;
  }[] = [];
  let ambassadors: Parameters<
    typeof AdminAmbassadors
  >[0]["ambassadors"] = [];
  let dbOk = true;

  try {
    if (["SUPER_ADMIN", "OPERATIONS", "FINANCE"].includes(principal.role)) {
      const orderRows = await prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          items: true,
          payments: { orderBy: { createdAt: "desc" } },
          refunds: { orderBy: { createdAt: "desc" } }
        }
      });
      orders = orderRows.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalTry: Number(order.totalTry),
        refundedTry: Number(order.refundedTry),
        productTotalAfterDiscountTry: Number(
          order.productTotalAfterDiscountTry
        ),
        productRefundedTry: Number(order.productRefundedTry),
        discountTry: Number(order.discountTry),
        promoCode: order.promoCode,
        trackingNumber: order.trackingNumber,
        paidEmailSentAt: order.paidEmailSentAt,
        createdAt: order.createdAt,
        items: order.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity
        })),
        payments: order.payments.map((payment) => ({
          status: payment.status,
          errorMessage: payment.errorMessage,
          callbackAt: payment.callbackAt
        })),
        refunds: order.refunds.map((refund) => ({
          id: refund.id,
          amountTry: Number(refund.amountTry),
          productRefundTry: Number(refund.productRefundTry),
          reason: refund.reason,
          status: refund.status,
          createdAt: refund.createdAt
        }))
      }));
    }
    if (["SUPER_ADMIN", "OPERATIONS"].includes(principal.role)) {
      await ensureInventorySeeded();
      const inventoryRows = await prisma.productInventory.findMany({
        orderBy: { productId: "asc" }
      });
      inventory = inventoryRows.map((r) => ({
        productId: r.productId,
        sku: r.sku,
        stock: r.stock,
        name: getCatalogProduct(r.productId)?.name.tr ?? r.productId,
        priceTry: getCatalogProduct(r.productId)?.priceTry ?? 0
      }));
    }
    const ambassadorRows = await prisma.ambassador.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        documents: { orderBy: { uploadedAt: "desc" } },
        coupons: { orderBy: { createdAt: "desc" } },
        shipments: { orderBy: { createdAt: "desc" } },
        contents: { orderBy: { createdAt: "desc" } },
        payouts: { orderBy: { createdAt: "desc" } },
        fraudFlags: {
          where: { status: { in: ["OPEN", "REVIEWING"] } },
          orderBy: { createdAt: "desc" }
        }
      }
    });
    const canSeeFinance = ["SUPER_ADMIN", "FINANCE"].includes(principal.role);
    const canSeeDocuments = [
      "SUPER_ADMIN",
      "OPERATIONS",
      "FINANCE"
    ].includes(principal.role);
    ambassadors = ambassadorRows.map((row) => ({
      id: row.id,
      publicId: row.publicId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      status: row.status,
      taxType: canSeeFinance ? row.taxType : null,
      taxIdLast4: canSeeFinance ? row.taxIdLast4 : null,
      taxStatusValid: canSeeFinance ? row.taxStatusValid : false,
      ibanLast4: canSeeFinance ? row.ibanLast4 : null,
      ibanHolderName: canSeeFinance ? row.ibanHolderName : null,
      primarySocialPlatform: row.primarySocialPlatform,
      instagramUsername: row.instagramUsername,
      tiktokUsername: row.tiktokUsername,
      youtubeUsername: row.youtubeUsername,
      createdAt: row.createdAt,
      documents: canSeeDocuments
        ? row.documents.map((document) => ({
            id: document.id,
            documentType: document.documentType,
            originalName: document.originalName,
            status: document.status,
            uploadedAt: document.uploadedAt
          }))
        : [],
      coupons: row.coupons.map((coupon) => ({
        code: coupon.code,
        active: coupon.active
      })),
      shipments: row.shipments.map((shipment) => ({
        id: shipment.id,
        status: shipment.status,
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber
      })),
      contents: row.contents.map((content) => ({
        id: content.id,
        platform: content.platform,
        contentType: content.contentType,
        publishedUrl: content.publishedUrl,
        captionText: content.captionText,
        status: content.status,
        isFirstContent: content.isFirstContent
      })),
      payouts: canSeeFinance
        ? row.payouts.map((payout) => ({
            id: payout.id,
            periodStart: payout.periodStart,
            periodEnd: payout.periodEnd,
            netPayout: Number(payout.netPayout),
            status: payout.status
          }))
        : [],
      fraudFlags: ["SUPER_ADMIN", "OPERATIONS"].includes(principal.role)
        ? row.fraudFlags.map((flag) => ({
            id: flag.id,
            type: flag.type,
            severity: flag.severity,
            notes: flag.notes,
            status: flag.status
          }))
        : []
    }));
  } catch {
    dbOk = false;
  }

  if (!dbOk) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="mt-3 text-sm text-neutral-600">
          Veritabanına bağlanılamadı. DATABASE_URL ve prisma migrate kontrol edin.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <AdminReadiness />
      {["SUPER_ADMIN", "OPERATIONS", "FINANCE"].includes(principal.role) ? (
        <AdminOrders
          orders={orders}
          role={
            principal.role as "SUPER_ADMIN" | "OPERATIONS" | "FINANCE"
          }
        />
      ) : null}
      {["SUPER_ADMIN", "OPERATIONS"].includes(principal.role) ? (
        <AdminInventory inventory={inventory} />
      ) : null}
      <AdminAmbassadors
        ambassadors={ambassadors}
        role={principal.role}
      />
    </main>
  );
}
