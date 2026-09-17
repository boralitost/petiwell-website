function numberEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function integerEnv(name: string, fallback: number, min: number, max: number): number {
  return Math.floor(numberEnv(name, fallback, min, max));
}

export function ambassadorConfig() {
  return {
    commissionRate: numberEnv("AMBASSADOR_COMMISSION_RATE", 0.15, 0, 1),
    customerDiscountRate: numberEnv("AMBASSADOR_CUSTOMER_DISCOUNT", 0.1, 0, 1),
    minPayoutTry: numberEnv("AMBASSADOR_MIN_PAYOUT_TRY", 500, 1, 1_000_000),
    referralDays: integerEnv("AMBASSADOR_REFERRAL_DAYS", 30, 1, 365),
    commissionHoldDays: integerEnv("AMBASSADOR_COMMISSION_HOLD_DAYS", 14, 0, 365),
    firstContentDays: integerEnv("AMBASSADOR_FIRST_CONTENT_DAYS", 14, 1, 365),
    finalWarningDays: integerEnv("AMBASSADOR_FINAL_WARNING_DAYS", 3, 1, 90),
    standardCorrectionHours: integerEnv(
      "AMBASSADOR_STANDARD_CORRECTION_HOURS",
      48,
      1,
      720
    ),
    urgentCorrectionHours: integerEnv(
      "AMBASSADOR_URGENT_CORRECTION_HOURS",
      24,
      1,
      168
    ),
    terminationNoticeDays: integerEnv(
      "AMBASSADOR_TERMINATION_NOTICE_DAYS",
      15,
      0,
      365
    ),
    inactivityDays: integerEnv("AMBASSADOR_INACTIVITY_DAYS", 90, 1, 730),
    inactivityWarningDays: integerEnv(
      "AMBASSADOR_INACTIVITY_WARNING_DAYS",
      7,
      1,
      90
    ),
    retentionDays: integerEnv(
      "AMBASSADOR_RETENTION_DAYS",
      1825,
      30,
      3650
    ),
    retentionJobEnabled:
      process.env.AMBASSADOR_RETENTION_JOB_ENABLED === "true",
    vatRate: numberEnv("AMBASSADOR_PRODUCT_VAT_RATE", 20, 0, 100),
    inviteDays: integerEnv("AMBASSADOR_INVITE_DAYS", 14, 1, 90),
    maxDocumentBytes: integerEnv(
      "AMBASSADOR_MAX_DOCUMENT_BYTES",
      4 * 1024 * 1024,
      100_000,
      10 * 1024 * 1024
    )
  } as const;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
