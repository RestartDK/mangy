import { db } from "@mangy/db";
import { source } from "@mangy/db/schema";
import type {
  SourceFilterDefinition,
  SourceListResponse,
  SourceSearchInput,
  SourceSeries,
} from "@mangy/source-sdk";
import { asc } from "drizzle-orm";

import { sourceRegistry } from "./registry";
import { SourcesStorage } from "./storage";

interface DiscoverSection {
  id: "popular" | "latest" | "trending";
  title: string;
  type: "popular" | "latest" | "trending";
  items: SourceSeries[];
}

const mapSeriesResponse = (sourceId: string, item: SourceSeries) => ({
  sourceId,
  seriesId: item.externalId,
  title: item.title,
  description: item.description,
  canonicalUrl: item.canonicalUrl,
  coverImageUrl: item.coverImageUrl,
  status: item.status,
  originalLanguage: item.originalLanguage,
  latestChapter: item.latestChapter,
  contentRating: item.contentRating,
  publicationDemographic: item.publicationDemographic,
  authorNames: item.authorNames,
  artistNames: item.artistNames,
  tags: item.tags,
  availableTranslatedLanguages: item.availableTranslatedLanguages,
});

const mapListResponse = (
  sourceId: string,
  response: SourceListResponse<SourceSeries>
) => ({
  items: response.items.map((item) => mapSeriesResponse(sourceId, item)),
  page: response.page,
  pageSize: response.pageSize,
  total: response.total,
  hasNextPage: response.hasNextPage,
});

const normalizeLimit = (limit: number | undefined): number => {
  if (!limit || limit < 1) {
    return 12;
  }

  return Math.min(limit, 24);
};

export abstract class SourcesService {
  static async list() {
    await SourcesStorage.syncSources(sourceRegistry.list());

    const rows = await db.select().from(source).orderBy(asc(source.name));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      websiteUrl: row.websiteUrl,
      iconUrl: row.iconUrl,
      languageCode: row.languageCode,
      supportedLanguages: row.supportedLanguages,
      isEnabled: row.isEnabled,
      capabilities: {
        supportsPopular: row.supportsPopular,
        supportsLatest: row.supportsLatest,
        supportsTrending: row.supportsTrending,
        supportsSearch: row.supportsSearch,
        supportsFilters: row.supportsFilters,
        supportsSeriesDetails: row.supportsSeriesDetails,
        supportsChapterFeed: row.supportsChapterFeed,
        supportsPageFetch: row.supportsPageFetch,
      },
    }));
  }

  static getSourceOrThrow(sourceId: string) {
    const adapter = sourceRegistry.get(sourceId);
    if (!adapter) {
      throw new Error(`Unknown source: ${sourceId}`);
    }

    return adapter;
  }

  static async getFilters(sourceId: string): Promise<SourceFilterDefinition[]> {
    const adapter = SourcesService.getSourceOrThrow(sourceId);
    return adapter.getFilters();
  }

  static async getDiscover(sourceId: string, limit?: number) {
    const adapter = SourcesService.getSourceOrThrow(sourceId);
    const resolvedLimit = normalizeLimit(limit);

    const sections: DiscoverSection[] = [];

    if (adapter.metadata.capabilities.supportsPopular) {
      const popular = await adapter.getPopular(1, resolvedLimit);
      await SourcesStorage.upsertSeries(sourceId, popular.items);
      sections.push({
        id: "popular",
        title: "Popular this month",
        type: "popular",
        items: popular.items,
      });
    }

    if (adapter.metadata.capabilities.supportsTrending && adapter.getTrending) {
      const trending = await adapter.getTrending(1, resolvedLimit);
      await SourcesStorage.upsertSeries(sourceId, trending.items);
      sections.push({
        id: "trending",
        title: "Trending now",
        type: "trending",
        items: trending.items,
      });
    }

    if (adapter.metadata.capabilities.supportsLatest) {
      const latest = await adapter.getLatest(1, resolvedLimit);
      await SourcesStorage.upsertSeries(sourceId, latest.items);
      sections.push({
        id: "latest",
        title: "Latest updates",
        type: "latest",
        items: latest.items,
      });
    }

    return sections.map((section) => ({
      id: section.id,
      title: section.title,
      type: section.type,
      items: section.items.map((item) => mapSeriesResponse(sourceId, item)),
    }));
  }

  static async search(sourceId: string, input: SourceSearchInput) {
    const adapter = SourcesService.getSourceOrThrow(sourceId);
    const result = await adapter.searchSeries(input);
    await SourcesStorage.upsertSeries(sourceId, result.items);
    return mapListResponse(sourceId, result);
  }
}
