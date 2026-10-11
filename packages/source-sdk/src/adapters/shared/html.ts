import { load } from "cheerio";
import type { CheerioAPI } from "cheerio";

export const loadDocument = (html: string): CheerioAPI => load(html);

export const hasText = (value: string | null | undefined): value is string =>
  value !== null && value !== undefined && value.length > 0;

export const normalizeText = (value: string | null | undefined): string =>
  value?.replaceAll(/\s+/gu, " ").trim() ?? "";

export const nullableText = (
  value: string | null | undefined
): string | null => {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
};

export const uniqueStrings = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
};
