import { Dictionary } from "@/lib/dictionary";

export function accountErrorCopy(dict: Dictionary, code: string): string {
  const map: Record<string, string> = {
    invalid_email: dict.account.invalidEmail,
    invalid_link: dict.account.invalidLink,
    invalid_credentials: dict.account.invalidCredentials,
    email_taken: dict.account.emailTaken,
    weak_password: dict.account.weakPassword,
    password_mismatch: dict.account.passwordMismatch,
    email_unverified: dict.account.emailUnverified,
    invalid_code: dict.account.invalidCode,
    invalid_location: dict.account.invalidLocation
  };
  return map[code] || code;
}
