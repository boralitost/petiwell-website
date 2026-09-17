import { resolveEmailFrom } from "@/lib/email-from";
import { isDirectSalesEnabled } from "@/lib/commerce";
import { isCompanyInfoComplete } from "@/lib/company";
import { paytrConfigReady } from "@/lib/orders";

export type ReadinessFlag = {
  id: string;
  ok: boolean;
  blocking: boolean;
  note: string;
};

/** Non-secret readiness snapshot for admin / ops. Never returns secret values. */
export function getCommerceReadiness(): {
  salesEnabled: boolean;
  readyToEnableSales: boolean;
  flags: ReadinessFlag[];
} {
  const pricesOk =
    Number(process.env.PRODUCT_PRICE_PLUS_B) > 0 &&
    Number(process.env.PRODUCT_PRICE_STERILE_PASTE) > 0;
  const stockEnvOk =
    Number(process.env.PRODUCT_STOCK_PLUS_B) > 0 &&
    Number(process.env.PRODUCT_STOCK_STERILE_PASTE) > 0;
  const shippingIncluded =
    Number(process.env.SHIPPING_FLAT_TRY ?? "0") === 0;
  const from = resolveEmailFrom(process.env.EMAIL_FROM) || "";
  const emailOk =
    Boolean(process.env.RESEND_API_KEY) &&
    Boolean(from);
  const dbOk = Boolean(process.env.DATABASE_URL);
  const adminOk = Boolean(
    process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET
  );
  const paytrOk = paytrConfigReady();
  const companyOk = isCompanyInfoComplete();

  const flags: ReadinessFlag[] = [
    {
      id: "company",
      ok: companyOk,
      blocking: true,
      note: "COMPANY_* satıcı kimliği"
    },
    {
      id: "prices",
      ok: pricesOk,
      blocking: true,
      note: "PRODUCT_PRICE_* > 0"
    },
    {
      id: "stock_env",
      ok: stockEnvOk,
      blocking: true,
      note: "PRODUCT_STOCK_* > 0"
    },
    {
      id: "shipping_included",
      ok: shippingIncluded,
      blocking: false,
      note: "SHIPPING_FLAT_TRY=0 (kargo fiyata dahil)"
    },
    {
      id: "database",
      ok: dbOk,
      blocking: true,
      note: "DATABASE_URL"
    },
    {
      id: "admin",
      ok: adminOk,
      blocking: true,
      note: "ADMIN_PASSWORD + ADMIN_SESSION_SECRET"
    },
    {
      id: "paytr",
      ok: paytrOk,
      blocking: true,
      note: "PAYTR_MERCHANT_ID/KEY/SALT"
    },
    {
      id: "email",
      ok: emailOk,
      blocking: true,
      note: "RESEND_API_KEY + EMAIL_FROM (@petiwell.com; Gmail From olamaz)"
    },
    {
      id: "sales_flag",
      ok: true,
      blocking: false,
      note: isDirectSalesEnabled()
        ? "DIRECT_SALES açık (Preview test / canlı)"
        : "DIRECT_SALES kapalı (petiwell.com müşteri satışı kapalı kalmalı)"
    }
  ];

  const readyToEnableSales = flags
    .filter((f) => f.blocking)
    .every((f) => f.ok);

  return {
    salesEnabled: isDirectSalesEnabled(),
    readyToEnableSales,
    flags
  };
}

export function getAmbassadorTechnicalReadiness(): {
  ready: boolean;
  flags: ReadinessFlag[];
} {
  const encryptionKey = Buffer.from(
    process.env.AMBASSADOR_DATA_ENCRYPTION_KEY || "",
    "base64"
  );
  const flags: ReadinessFlag[] = [
    {
      id: "ambassador_encryption",
      ok: encryptionKey.length === 32,
      blocking: true,
      note: "32-byte AMBASSADOR_DATA_ENCRYPTION_KEY"
    },
    {
      id: "ambassador_hashing",
      ok: Boolean(process.env.AMBASSADOR_HASH_PEPPER),
      blocking: true,
      note: "AMBASSADOR_HASH_PEPPER"
    },
    {
      id: "referral_signing",
      ok: Boolean(process.env.AMBASSADOR_REFERRAL_SECRET),
      blocking: true,
      note: "AMBASSADOR_REFERRAL_SECRET"
    },
    {
      id: "private_storage",
      ok: Boolean(
        process.env.BLOB_READ_WRITE_TOKEN ||
          process.env.BLOB_STORE_ID ||
          (process.env.AMBASSADOR_STORAGE_ENDPOINT &&
            process.env.AMBASSADOR_STORAGE_BUCKET &&
            process.env.AMBASSADOR_STORAGE_ACCESS_KEY_ID &&
            process.env.AMBASSADOR_STORAGE_SECRET_ACCESS_KEY)
      ),
      blocking: true,
      note: "Private Vercel Blob veya S3 object storage"
    },
    {
      id: "malware_scanner",
      ok: Boolean(
        process.env.AMBASSADOR_FILE_SCAN_URL ||
          process.env.AMBASSADOR_FILE_SCAN_PROVIDER === "vercel_sandbox"
      ),
      blocking: true,
      note: "HTTP scanner veya izole Vercel Sandbox + ClamAV"
    },
    {
      id: "admin_mfa",
      ok: Boolean(
        process.env.ADMIN_DATABASE_AUTH_ENABLED === "true" ||
          process.env.ADMIN_TOTP_SECRET
      ),
      blocking: true,
      note: "DB admin MFA veya ADMIN_TOTP_SECRET"
    },
    {
      id: "cron_auth",
      ok: Boolean(process.env.CRON_SECRET),
      blocking: true,
      note: "CRON_SECRET"
    },
    {
      id: "shipment_webhook",
      ok: Boolean(process.env.SHIPMENT_WEBHOOK_SECRET),
      blocking: false,
      note: "SHIPMENT_WEBHOOK_SECRET"
    }
  ];
  return {
    ready: flags.filter((flag) => flag.blocking).every((flag) => flag.ok),
    flags
  };
}
