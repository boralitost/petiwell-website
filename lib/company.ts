/**
 * Seller identity for contact, checkout, invoices, and legal pages.
 * Prefer env vars in production; placeholders must be replaced before live sales.
 */
export type CompanyInfo = {
  legalName: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  taxOffice: string;
  taxNumber: string;
  mersis: string;
};

function env(key: string, fallback = ""): string {
  return (process.env[key] ?? fallback).trim();
}

export function getCompanyInfo(): CompanyInfo {
  return {
    legalName: env("COMPANY_LEGAL_NAME", "[ŞİRKET UNVANI — DOLDURUN]"),
    address: env("COMPANY_ADDRESS", "[Açık adres — doldurun]"),
    city: env("COMPANY_CITY", "[İl / İlçe — doldurun]"),
    phone: env("COMPANY_PHONE", "[Telefon — doldurun]"),
    email: env("COMPANY_EMAIL", "hello@petiwell.com"),
    taxOffice: env("COMPANY_TAX_OFFICE", "[Vergi dairesi — doldurun]"),
    taxNumber: env("COMPANY_TAX_NUMBER", "[VKN — doldurun]"),
    mersis: env("COMPANY_MERSIS", "")
  };
}

export function isCompanyInfoComplete(info: CompanyInfo = getCompanyInfo()): boolean {
  // MERSİS optional for şahıs işletmesi
  const required: (keyof CompanyInfo)[] = [
    "legalName",
    "address",
    "city",
    "phone",
    "email",
    "taxOffice",
    "taxNumber"
  ];
  return required.every((key) => {
    const value = info[key];
    return value.length > 0 && !value.includes("doldurun") && !value.includes("DOLDURUN");
  });
}
