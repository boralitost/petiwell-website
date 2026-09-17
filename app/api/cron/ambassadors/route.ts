import { NextRequest, NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin-auth";
import { createDueAmbassadorPayouts } from "@/lib/ambassador-payout";
import {
  processAmbassadorDeadlines,
  purgeExpiredAmbassadorData
} from "@/lib/ambassador-automation";
import { refreshClamAvSnapshot } from "@/lib/ambassador-scanner";
import { reconcilePendingRefunds } from "@/lib/refunds";
import { alertOperationsIfNeeded } from "@/lib/operations-health";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const bearer = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  const cronAuthorized =
    Boolean(cronSecret) && bearer === `Bearer ${cronSecret}`;
  if (!cronAuthorized && !(await requireAdminRole(["SUPER_ADMIN"]))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const automation = await processAmbassadorDeadlines();
  const retention = await purgeExpiredAmbassadorData();
  const scanner = await refreshClamAvSnapshot().catch((error) => ({
    refreshed: false,
    error: error instanceof Error ? error.message : "scanner_refresh_failed"
  }));
  const refunds = await reconcilePendingRefunds();
  const operations = await alertOperationsIfNeeded();
  const day = new Date(Date.now() + 3 * 60 * 60 * 1000).getUTCDate();
  if (![1, 15].includes(day) && req.nextUrl.searchParams.get("force") !== "true") {
    return NextResponse.json({
      ok: true,
      payoutSkipped: true,
      automation,
      retention,
      scanner,
      refunds,
      operations
    });
  }
  const result = await createDueAmbassadorPayouts();
  return NextResponse.json({
    ok: true,
    automation,
    retention,
    scanner,
    refunds,
    operations,
    ...result
  });
}
