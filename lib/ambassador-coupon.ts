const TURKISH_ASCII: Record<string, string> = {
  Ç: "C",
  Ğ: "G",
  İ: "I",
  I: "I",
  Ö: "O",
  Ş: "S",
  Ü: "U",
  ç: "C",
  ğ: "G",
  ı: "I",
  i: "I",
  ö: "O",
  ş: "S",
  ü: "U"
};

export function normalizeAmbassadorCoupon(raw: string): string {
  return raw
    .trim()
    .split("")
    .map((char) => TURKISH_ASCII[char] || char)
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 24);
}

export function couponCandidates(firstName: string, lastName = ""): string[] {
  const first = normalizeAmbassadorCoupon(firstName) || "PETIWELL";
  const last = normalizeAmbassadorCoupon(lastName);
  const candidates = [
    `${first}10`,
    `${first}${last.slice(0, 1)}10`,
    `${first.slice(0, 8)}${last.slice(0, 3)}10`,
    `${first.slice(0, 8)}${last.slice(-3)}10`
  ];
  return [...new Set(candidates.map(normalizeAmbassadorCoupon).filter((code) => code.length >= 4))];
}

export function isValidAmbassadorCoupon(raw: string): boolean {
  const code = normalizeAmbassadorCoupon(raw);
  return code.length >= 4 && code.length <= 24 && /^[A-Z0-9]+$/.test(code);
}
