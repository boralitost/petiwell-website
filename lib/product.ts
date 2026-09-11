import { Locale } from "./i18n";

export type LocalizedField = {
  tr: string;
  en: string;
};

export type ProductId = "plus-b" | "sterile-paste";

export interface Product {
  id: ProductId;
  slug: string;
  name: LocalizedField;
  shortName: LocalizedField;
  format: LocalizedField;
  category: LocalizedField;
  positioning: LocalizedField;
  shortDescription: LocalizedField;
  fullDescription: LocalizedField;
  ingredients: {
    id: string;
    name: LocalizedField;
  }[];
  ingredientsSummary: LocalizedField;
  highlights: LocalizedField[];
  usageSteps: {
    id: string;
    title: LocalizedField;
    description: LocalizedField;
  }[];
  /** Empty string until real product URL is provided — never fake a PDP. */
  trendyolUrl: string;
  images: string[];
  campaignEligible: boolean;
  promoLabel: LocalizedField;
  accent: "orange" | "purple";
  /** Commerce fields — prices are KDV-inclusive TRY list prices. Set before enabling direct sales. */
  sku: string;
  /** List price in TRY. 0 = not sellable on-site yet. */
  priceTry: number;
  stock: number;
}

/**
 * Update Trendyol product page URLs here only.
 */
export const TRENDYOL_URLS: Record<ProductId, string> = {
  "plus-b":
    "https://www.trendyol.com/petiwell/plus-b-tuy-dokulmesi-onleyici-kedi-vitamini-50-ml-p-1167315376?boutiqueId=61&merchantId=1293158&filterOverPriceListings=false&sav=true",
  "sterile-paste":
    "https://www.trendyol.com/petiwell/tuy-dokulme-engelleyici-tuy-yumagi-ve-kusma-onleyici-multivitamin-kedi-malt-macun-100-gr-p-1167309791?boutiqueId=61&merchantId=1293158&filterOverPriceListings=false&sav=true"
};

const products: Product[] = [
  {
    id: "plus-b",
    slug: "petiwell-plus-b",
    name: {
      tr: "Petiwell Plus + B Tüy Dökülmesi Önleyici Kedi Vitamini",
      en: "Petiwell Plus + B Cat Vitamin for Coat & Skin Care"
    },
    shortName: {
      tr: "Plus + B",
      en: "Plus + B"
    },
    format: {
      tr: "50 ml",
      en: "50 ml"
    },
    category: {
      tr: "Günlük Vitamin Damlası",
      en: "Daily Vitamin Drop"
    },
    positioning: {
      tr: "Tüy ve deri bakım desteği",
      en: "Coat and skin care support"
    },
    shortDescription: {
      tr: "Biotin, Folik Asit ve Çinko içeren damlalıklı formülüyle günlük tüy ve deri bakımını destekler.",
      en: "A dropper formula with biotin, folic acid, and zinc that supports daily coat and skin care."
    },
    fullDescription: {
      tr: "Petiwell Plus + B; tüy ve deri bakımını desteklemek üzere formüle edilmiş multi-vitamin damlasıdır. Biotin, Folik Asit ve Çinko içeren 50 ml damlalık formatıyla günlük kullanıma kolayca eklenir.",
      en: "Petiwell Plus + B is a multi-vitamin drop formulated to support coat and skin care. With biotin, folic acid, and zinc in a 50 ml dropper format, it fits easily into everyday use."
    },
    ingredients: [
      { id: "biotin", name: { tr: "Biotin", en: "Biotin" } },
      { id: "folic", name: { tr: "Folik Asit", en: "Folic Acid" } },
      { id: "zinc", name: { tr: "Çinko", en: "Zinc" } }
    ],
    ingredientsSummary: {
      tr: "Tüy ve deri bakımını destekleyen içerik kombinasyonu.",
      en: "An ingredient combination that supports coat and skin care."
    },
    highlights: [
      {
        tr: "Tüy ve deri bakımına odaklanır",
        en: "Focused on coat and skin care"
      },
      {
        tr: "Biotin, Folik Asit ve Çinko içerir",
        en: "Contains biotin, folic acid, and zinc"
      },
      {
        tr: "50 ml pratik damlalık formatı",
        en: "Practical 50 ml dropper format"
      }
    ],
    usageSteps: [
      {
        id: "shake",
        title: {
          tr: "İyice çalkalayın",
          en: "Shake well"
        },
        description: {
          tr: "Kullanmadan önce şişeyi çalkalayın.",
          en: "Shake the bottle before use."
        }
      },
      {
        id: "dropper",
        title: {
          tr: "Damlalıkla ürünü alın",
          en: "Take with the dropper"
        },
        description: {
          tr: "Kapağı açarak önerilen miktarı damlalıkla alın.",
          en: "Open the cap and take the suggested amount with the dropper."
        }
      },
      {
        id: "serve",
        title: {
          tr: "Uygun şekilde verin",
          en: "Offer as preferred"
        },
        description: {
          tr: "Doğrudan verebilir veya mama ile birlikte kullanabilirsiniz. Kullanım miktarı için ürün etiketini takip edin.",
          en: "Offer directly or with food. Follow the product label for suggested amounts."
        }
      }
    ],
    trendyolUrl: TRENDYOL_URLS["plus-b"],
    images: [
      "/plus-b/1.png",
      "/plus-b/2.png",
      "/plus-b/3.png",
      "/plus-b/5.png",
      "/plus-b/6.png"
    ],
    campaignEligible: true,
    accent: "orange",
    promoLabel: {
      tr: "2. Ürün 1 TL*",
      en: "2nd Product 1 TL*"
    },
    sku: "PW-PLUS-B-50ML",
    priceTry: envNumber("PRODUCT_PRICE_PLUS_B", 0),
    stock: envNumber("PRODUCT_STOCK_PLUS_B", 0)
  },
  {
    id: "sterile-paste",
    slug: "petiwell-sterile-paste",
    name: {
      tr: "Petiwell Sterile Paste Kısırlaştırılmış Kediler için Malt Macun",
      en: "Petiwell Sterile Paste Malt for Sterilized Cats"
    },
    shortName: {
      tr: "Sterile Paste",
      en: "Sterile Paste"
    },
    format: {
      tr: "100 gr",
      en: "100 g"
    },
    category: {
      tr: "Anti-Hairball Malt Macunu",
      en: "Anti-Hairball Malt Paste"
    },
    positioning: {
      tr: "Tüy yumağı bakım desteği",
      en: "Hairball care support"
    },
    shortDescription: {
      tr: "Yalanma sırasında yutulan tüylerin oluşturduğu tüy yumağı bakımına yönelik 100 gr malt macunu.",
      en: "A 100 g malt paste focused on hairball care related to hair swallowed while grooming."
    },
    fullDescription: {
      tr: "Petiwell Sterile Paste; kedilerin yalanırken yuttuğu tüylerin oluşturduğu tüy yumağı bakımına odaklanan malt macunudur. Cranberry, Multi-Vitamin ve Methionine içeren 100 gr tüp formuyla özellikle kısırlaştırılmış kedilerin günlük kullanımına yönelik konumlanır.",
      en: "Petiwell Sterile Paste is a malt paste focused on hairball care related to the hair cats swallow while grooming. With cranberry, multi-vitamin, and methionine in a 100 g tube, it is positioned for sterilized cats’ everyday use."
    },
    ingredients: [
      { id: "cranberry", name: { tr: "Cranberry", en: "Cranberry" } },
      {
        id: "multivitamin",
        name: { tr: "Multi-Vitamin", en: "Multi-Vitamin" }
      },
      { id: "methionine", name: { tr: "Methionine", en: "Methionine" } }
    ],
    ingredientsSummary: {
      tr: "Tüy yumağı bakımına yönelik içerik kombinasyonu.",
      en: "An ingredient combination focused on hairball care."
    },
    highlights: [
      {
        tr: "Tüy yumağı bakımına odaklanır",
        en: "Focused on hairball care"
      },
      {
        tr: "Cranberry, Multi-Vitamin ve Methionine içerir",
        en: "Contains cranberry, multi-vitamin, and methionine"
      },
      {
        tr: "100 gr malt macunu formatı",
        en: "100 g malt paste format"
      }
    ],
    usageSteps: [
      {
        id: "prepare",
        title: {
          tr: "Önerilen miktarı hazırlayın",
          en: "Prepare the suggested amount"
        },
        description: {
          tr: "Ürün etiketindeki kullanım önerisini takip edin.",
          en: "Follow the usage guidance on the product label."
        }
      },
      {
        id: "serve",
        title: {
          tr: "Uygun şekilde verin",
          en: "Offer as preferred"
        },
        description: {
          tr: "Doğrudan veya kedinizin tercihine uygun şekilde sunun.",
          en: "Offer directly or in a way that suits your cat."
        }
      },
      {
        id: "routine",
        title: {
          tr: "Düzenli kullanıma devam edin",
          en: "Keep use consistent"
        },
        description: {
          tr: "Kullanım sıklığı için ürün etiketindeki bilgileri takip edin.",
          en: "Follow the product label for suggested use frequency."
        }
      }
    ],
    trendyolUrl: TRENDYOL_URLS["sterile-paste"],
    images: [
      "/sterile-paste/1.png",
      "/sterile-paste/2.png",
      "/sterile-paste/3.png",
      "/sterile-paste/5.png",
      "/sterile-paste/6.png"
    ],
    campaignEligible: true,
    accent: "purple",
    promoLabel: {
      tr: "2. Ürün 1 TL*",
      en: "2nd Product 1 TL*"
    },
    sku: "PW-STERILE-PASTE-100G",
    priceTry: envNumber("PRODUCT_PRICE_STERILE_PASTE", 0),
    stock: envNumber("PRODUCT_STOCK_STERILE_PASTE", 0)
  }
];

function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getProducts(locale: Locale) {
  return products.map((product) => localizeProduct(product, locale));
}

export function getProduct(locale: Locale, id: ProductId) {
  const product = products.find((item) => item.id === id) ?? products[0];
  return localizeProduct(product, locale);
}

function localizeProduct(product: Product, locale: Locale) {
  const trendyolUrl = TRENDYOL_URLS[product.id] || product.trendyolUrl;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name[locale],
    shortName: product.shortName[locale],
    format: product.format[locale],
    category: product.category[locale],
    positioning: product.positioning[locale],
    shortDescription: product.shortDescription[locale],
    fullDescription: product.fullDescription[locale],
    ingredients: product.ingredients.map((item) => ({
      id: item.id,
      name: item.name[locale]
    })),
    ingredientsSummary: product.ingredientsSummary[locale],
    highlights: product.highlights.map((item) => item[locale]),
    usageSteps: product.usageSteps.map((step) => ({
      id: step.id,
      title: step.title[locale],
      description: step.description[locale]
    })),
    image: product.images[0],
    images: product.images,
    trendyolUrl,
    hasTrendyolUrl: Boolean(trendyolUrl),
    campaignEligible: product.campaignEligible,
    promoLabel: product.promoLabel[locale],
    accent: product.accent,
    sku: product.sku,
    priceTry: product.priceTry,
    stock: product.stock,
    inStock: product.stock > 0,
    sellableOnSite: product.priceTry > 0 && product.stock > 0
  };
}

/** Server-side catalog lookup (authoritative for checkout totals). */
export function getCatalogProduct(id: string) {
  return products.find((item) => item.id === id) ?? null;
}

export function listCatalogProducts() {
  return products.map((p) => ({
    id: p.id,
    sku: p.sku,
    nameTr: p.name.tr,
    nameEn: p.name.en,
    priceTry: p.priceTry,
    stock: p.stock
  }));
}

export type LocalizedProduct = ReturnType<typeof getProduct>;
