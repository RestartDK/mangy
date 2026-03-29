import { type CheerioAPI, load } from "cheerio";

export const loadDocument = (html: string): CheerioAPI => load(html);

export const normalizeText = (value: string | null | undefined): string =>
  value?.replace(/\s+/g, " ").trim() ?? "";

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
