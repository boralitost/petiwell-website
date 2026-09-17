import { getCompanyInfo, type CompanyInfo } from "@/lib/company";
import type { Locale } from "@/lib/i18n";

export function sellerIdentity(info: CompanyInfo = getCompanyInfo()): CompanyInfo {
  return info;
}

export function sellerDisplayName(info: CompanyInfo = getCompanyInfo()): string {
  return info.legalName.includes("DOLDURUN") || info.legalName.includes("doldurun")
    ? "Petiwell"
    : info.legalName;
}

export function sellerIdentityText(
  locale: Locale,
  info: CompanyInfo = getCompanyInfo()
): string {
  const lines =
    locale === "en"
      ? [
          `Legal name: ${info.legalName}`,
          `Address: ${info.address}`,
          `City: ${info.city}`,
          `Phone: ${info.phone}`,
          `E-mail: ${info.email}`,
          `Tax office / no.: ${info.taxOffice} / ${info.taxNumber}`,
          info.mersis ? `MERSIS: ${info.mersis}` : ""
        ]
      : [
          `Unvan: ${info.legalName}`,
          `Adres: ${info.address}`,
          `İl / ilçe: ${info.city}`,
          `Telefon: ${info.phone}`,
          `E-posta: ${info.email}`,
          `Vergi dairesi / no: ${info.taxOffice} / ${info.taxNumber}`,
          info.mersis ? `MERSİS: ${info.mersis}` : ""
        ];
  return lines.filter(Boolean).join("\n");
}

export function sellerVenue(info: CompanyInfo = getCompanyInfo()): string {
  const city = info.city.trim();
  if (!city || city.includes("doldurun") || city.includes("DOLDURUN")) {
    return "Satıcının yerleşim yeri";
  }
  return city;
}
