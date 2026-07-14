import { Locale } from "./i18n";
import tr from "@/content/tr";
import en from "@/content/en";

const dictionaries = {
  tr,
  en
};

export type Dictionary = (typeof dictionaries)[Locale];

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

