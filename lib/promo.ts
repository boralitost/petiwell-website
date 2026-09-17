export type PromoType = "set_total" | "percent_off" | "amount_off";

export type PromoDefinition = {
  code: string;
  type: PromoType;
  value: number;
  maxUses: number;
};

export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function roundTry(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parsePromoCatalog(rawJson?: string | null): PromoDefinition[] {
  const fromJson: PromoDefinition[] = [];
  const json = (rawJson || "").trim();
  if (json) {
    try {
      const parsed = JSON.parse(json) as unknown;
      if (Array.isArray(parsed)) {
        for (const row of parsed) {
          const promo = normalizeDefinition(row);
          if (promo) fromJson.push(promo);
        }
      }
    } catch {
      /* ignore malformed JSON */
    }
  }

  const single = (process.env.PROMO_SET_TOTAL_CODE || "").trim();
  const target = Number(process.env.PROMO_SET_TOTAL_TRY ?? "1");
  const maxUses = Math.max(1, Math.floor(Number(process.env.PROMO_SET_TOTAL_MAX_USES ?? "10")));
  if (single && Number.isFinite(target) && target >= 0.01) {
    fromJson.push({
      code: normalizePromoCode(single),
      type: "set_total",
      value: roundTry(target),
      maxUses
    });
  }

  const seen = new Set<string>();
  const unique: PromoDefinition[] = [];
  for (const promo of fromJson) {
    if (seen.has(promo.code)) continue;
    seen.add(promo.code);
    unique.push(promo);
  }
  return unique;
}

function normalizeDefinition(row: unknown): PromoDefinition | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const code = normalizePromoCode(String(rec.code || ""));
  const type = String(rec.type || "");
  const value = Number(rec.value);
  const maxUses = Math.max(1, Math.floor(Number(rec.maxUses ?? 1)));
  if (!code || code.length < 4) return null;
  if (type !== "set_total" && type !== "percent_off" && type !== "amount_off") {
    return null;
  }
  if (!Number.isFinite(value) || value < 0) return null;
  return { code, type, value: roundTry(value), maxUses };
}

export function findPromoDefinition(
  catalog: PromoDefinition[],
  rawCode: string
): PromoDefinition | null {
  const code = normalizePromoCode(rawCode);
  if (!code) return null;
  return catalog.find((p) => p.code === code) || null;
}

export function applyPromoToTotals(
  subtotalTry: number,
  shippingTry: number,
  promo: PromoDefinition
): { ok: true; discountTry: number; totalTry: number } | { ok: false; error: string } {
  const gross = roundTry(subtotalTry + shippingTry);
  if (gross <= 0) return { ok: false, error: "empty_cart" };

  if (promo.type === "set_total") {
    const target = roundTry(promo.value);
    if (target < 0.01) return { ok: false, error: "promo_invalid" };
    if (target >= gross) {
      return { ok: true, discountTry: 0, totalTry: gross };
    }
    return {
      ok: true,
      discountTry: roundTry(gross - target),
      totalTry: target
    };
  }

  if (promo.type === "percent_off") {
    if (promo.value <= 0 || promo.value > 100) {
      return { ok: false, error: "promo_invalid" };
    }
    const discountTry = roundTry((gross * promo.value) / 100);
    return {
      ok: true,
      discountTry,
      totalTry: roundTry(Math.max(0, gross - discountTry))
    };
  }

  const discountTry = roundTry(Math.min(promo.value, gross));
  return {
    ok: true,
    discountTry,
    totalTry: roundTry(Math.max(0, gross - discountTry))
  };
}
