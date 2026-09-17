import assert from "node:assert/strict";
import { test } from "node:test";

import { buildGa4PurchaseBody, orderToGa4Purchase } from "../lib/ga4-mp";
import { isConsentChoice } from "../lib/consent";
import {
  adsPurchaseSendTo,
  isAdsLabel,
  isGa4Id,
  isGoogleAdsId,
  isGtmId
} from "../lib/tracking-ids";

test("tracking IDs accept only real Google formats", () => {
  assert.equal(isGtmId("GTM-ABC123"), true);
  assert.equal(isGtmId("G-ABC123"), false);
  assert.equal(isGa4Id("G-ABCDEF12"), true);
  assert.equal(isGa4Id("GTM-ABC"), false);
  assert.equal(isGoogleAdsId("AW-123456789"), true);
  assert.equal(isGoogleAdsId("AW-"), false);
  assert.equal(isAdsLabel("AbC12_-x"), true);
  assert.equal(isAdsLabel("bad label"), false);
});

test("Ads purchase send_to stays empty without both ID and label", () => {
  const ads = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL;
  delete process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  delete process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL;
  assert.equal(adsPurchaseSendTo(), "");
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = "AW-111";
  process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL = "PurchaseLabel";
  assert.equal(adsPurchaseSendTo(), "AW-111/PurchaseLabel");
  if (ads === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  else process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = ads;
  if (label === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL;
  else process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL = label;
});

test("consent choices are only accepted or essential", () => {
  assert.equal(isConsentChoice("accepted"), true);
  assert.equal(isConsentChoice("essential"), true);
  assert.equal(isConsentChoice("accepted"), true);
  assert.equal(isConsentChoice("yes"), false);
});

test("GA4 purchase body uses order number as transaction_id", () => {
  const mapped = orderToGa4Purchase({
    id: "cuid1",
    orderNumber: "PW-20260917-ABCDEF",
    totalTry: "497.00",
    currency: "TRY",
    items: [
      {
        sku: "PW-PLUS-B-50ML",
        productId: "plus-b",
        productName: "Plus + B",
        unitPriceTry: "497.00",
        quantity: 1
      }
    ]
  });
  assert.equal(mapped.transactionId, "PW-20260917-ABCDEF");
  assert.equal(mapped.value, 497);
  const body = buildGa4PurchaseBody(mapped);
  assert.equal(body.events[0].name, "purchase");
  assert.equal(body.events[0].params.transaction_id, "PW-20260917-ABCDEF");
  assert.equal(body.client_id, "server.cuid1");
});
