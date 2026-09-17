export type AmbassadorPricedLine = {
  productId: string;
  unitPriceTry: number;
  quantity: number;
};

export type AmbassadorLineDiscount = {
  productId: string;
  campaignDiscountTry: number;
  ambassadorDiscountTry: number;
  finalProductTotalTry: number;
  netProductTry: number;
};

export type AmbassadorPricingResult = {
  grossProductTry: number;
  campaignDiscountTry: number;
  ambassadorDiscountTry: number;
  finalProductTry: number;
  netProductTry: number;
  commissionTry: number;
  discountedUnitCount: number;
  lines: AmbassadorLineDiscount[];
};

export function roundTry(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Applies "every second eligible unit is 1 TRY".
 * If prices diverge later, cheaper units are discounted first so the rule is deterministic
 * and never creates a larger discount than advertised.
 */
export function priceAmbassadorCart(input: {
  lines: AmbassadorPricedLine[];
  applySecondProductCampaign: boolean;
  customerDiscountRate: number;
  commissionRate: number;
  vatRate: number;
}): AmbassadorPricingResult {
  const merged = new Map<string, AmbassadorPricedLine>();
  for (const raw of input.lines) {
    const line = {
      productId: raw.productId,
      unitPriceTry: roundTry(Math.max(0, raw.unitPriceTry)),
      quantity: Math.max(0, Math.floor(raw.quantity))
    };
    const existing = merged.get(line.productId);
    if (existing && existing.unitPriceTry !== line.unitPriceTry) {
      throw new Error("ambassador_price_mismatch");
    }
    merged.set(line.productId, {
      ...line,
      quantity: (existing?.quantity || 0) + line.quantity
    });
  }
  const lines = [...merged.values()];
  const grossProductTry = roundTry(
    lines.reduce((sum, line) => sum + line.unitPriceTry * line.quantity, 0)
  );
  const eligibleQty = lines.reduce((sum, line) => sum + line.quantity, 0);
  let discountedUnitCount = input.applySecondProductCampaign
    ? Math.floor(eligibleQty / 2)
    : 0;

  const campaignByProduct = new Map<string, number>();
  const sorted = [...lines].sort(
    (a, b) => a.unitPriceTry - b.unitPriceTry || a.productId.localeCompare(b.productId)
  );
  for (const line of sorted) {
    if (discountedUnitCount <= 0) break;
    const count = Math.min(line.quantity, discountedUnitCount);
    const discount = roundTry(Math.max(0, line.unitPriceTry - 1) * count);
    campaignByProduct.set(
      line.productId,
      roundTry((campaignByProduct.get(line.productId) || 0) + discount)
    );
    discountedUnitCount -= count;
  }

  const campaignDiscountTry = roundTry(
    [...campaignByProduct.values()].reduce((sum, amount) => sum + amount, 0)
  );
  const campaignAdjusted = roundTry(grossProductTry - campaignDiscountTry);
  const customerDiscountRate = Math.min(1, Math.max(0, input.customerDiscountRate));
  const ambassadorDiscountTry = roundTry(campaignAdjusted * customerDiscountRate);
  const finalProductTry = roundTry(Math.max(0, campaignAdjusted - ambassadorDiscountTry));
  const vatMultiplier = 1 + Math.max(0, input.vatRate) / 100;
  const netProductTry = roundTry(finalProductTry / vatMultiplier);
  const commissionTry = roundTry(
    netProductTry * Math.min(1, Math.max(0, input.commissionRate))
  );

  let allocatedAmbassador = 0;
  const lineResults = lines.map((line, index) => {
    const gross = roundTry(line.unitPriceTry * line.quantity);
    const campaign = campaignByProduct.get(line.productId) || 0;
    const afterCampaign = roundTry(gross - campaign);
    const isLast = index === lines.length - 1;
    const ambassador = isLast
      ? roundTry(ambassadorDiscountTry - allocatedAmbassador)
      : roundTry(
          campaignAdjusted > 0
            ? ambassadorDiscountTry * (afterCampaign / campaignAdjusted)
            : 0
        );
    allocatedAmbassador = roundTry(allocatedAmbassador + ambassador);
    const final = roundTry(Math.max(0, afterCampaign - ambassador));
    return {
      productId: line.productId,
      campaignDiscountTry: campaign,
      ambassadorDiscountTry: ambassador,
      finalProductTotalTry: final,
      netProductTry: roundTry(final / vatMultiplier)
    };
  });

  return {
    grossProductTry,
    campaignDiscountTry,
    ambassadorDiscountTry,
    finalProductTry,
    netProductTry,
    commissionTry,
    discountedUnitCount: input.applySecondProductCampaign ? Math.floor(eligibleQty / 2) : 0,
    lines: lineResults
  };
}
