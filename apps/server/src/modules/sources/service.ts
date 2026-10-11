import { column, decodeRows, runSql, table } from "@mangy/db";
import { sourceColumns, sourceRow } from "@mangy/db/model";
import type {
  SourceFilterDefinition,
  SourceListResponse,
  SourceSearchInput,
  SourceSeries,
} from "@mangy/source-sdk";
import { sourceRegistry } from "@mangy/source-sdk/registry";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";

import { SourcesStorage } from "./storage";

interface DiscoverSection {
  id: "popular" | "latest" | "trending";
  title: string;
  type: "popular" | "latest" | "trending";
  items: SourceSeries[];
}

const mapSeriesResponse = (sourceId: string, item: SourceSeries) => ({
  artistNames: item.artistNames,
  authorNames: item.authorNames,
  availableTranslatedLanguages: item.availableTranslatedLanguages,
  canonicalUrl: item.canonicalUrl,
  contentRating: item.contentRating,
  coverImageUrl: item.coverImageUrl,
  description: item.description,
  latestChapter: item.latestChapter,
  originalLanguage: item.originalLanguage,
  publicationDemographic: item.publicationDemographic,
  seriesId: item.externalId,
  sourceId,
  status: item.status,
  tags: item.tags,
  title: item.title,
});

const mapListResponse = (
  sourceId: string,
  response: SourceListResponse<SourceSeries>
) => ({
  hasNextPage: response.hasNextPage,
  items: response.items.map((item) => mapSeriesResponse(sourceId, item)),
  page: response.page,
  pageSize: response.pageSize,
  total: response.total,
});

const normalizeLimit = (limit: number | undefined): number => {
  if (!limit || limit < 1) {
    return 12;
  }

  return Math.min(limit, 24);
};

const list = Effect.gen(function* listEffect() {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* decodeRows(
    sourceRow,
    yield* sql`SELECT * FROM ${table("source")} ORDER BY ${column(sourceColumns, "name")} ASC`
  );

  return rows.map((row) => ({
    capabilities: {
      supportsChapterFeed: row.supportsChapterFeed,
      supportsFilters: row.supportsFilters,
      supportsLatest: row.supportsLatest,
      supportsPageFetch: row.supportsPageFetch,
      supportsPopular: row.supportsPopular,
      supportsSearch: row.supportsSearch,
      supportsSeriesDetails: row.supportsSeriesDetails,
      supportsTrending: row.supportsTrending,
    },
    description: row.description,
    iconUrl: row.iconUrl,
    id: row.id,
    isEnabled: row.isEnabled,
    languageCode: row.languageCode,
    name: row.name,
    supportedLanguages: row.supportedLanguages,
    websiteUrl: row.websiteUrl,
  }));
});

export const SourcesService = {
  async getDiscover(sourceId: string, limit?: number) {
    const adapter = SourcesService.getSourceOrThrow(sourceId);
    const resolvedLimit = normalizeLimit(limit);

    const sections: DiscoverSection[] = [];

    if (adapter.metadata.capabilities.supportsPopular) {
      const popular = await adapter.getPopular(1, resolvedLimit);
      await SourcesStorage.upsertSeries(sourceId, popular.items);
      sections.push({
        id: "popular",
        items: popular.items,
        title: "Popular this month",
        type: "popular",
      });
    }

    if (adapter.metadata.capabilities.supportsTrending && adapter.getTrending) {
      const trending = await adapter.getTrending(1, resolvedLimit);
      await SourcesStorage.upsertSeries(sourceId, trending.items);
      sections.push({
        id: "trending",
        items: trending.items,
        title: "Trending now",
        type: "trending",
      });
    }

    if (adapter.metadata.capabilities.supportsLatest) {
      const latest = await adapter.getLatest(1, resolvedLimit);
      await SourcesStorage.upsertSeries(sourceId, latest.items);
      sections.push({
        id: "latest",
        items: latest.items,
        title: "Latest updates",
        type: "latest",
      });
    }

    return sections.map((section) => ({
      id: section.id,
      items: section.items.map((item) => mapSeriesResponse(sourceId, item)),
      title: section.title,
      type: section.type,
    }));
  },

  async getFilters(sourceId: string): Promise<SourceFilterDefinition[]> {
    const adapter = SourcesService.getSourceOrThrow(sourceId);
    return await adapter.getFilters();
  },

  getSourceOrThrow(sourceId: string) {
    const adapter = sourceRegistry.get(sourceId);
    if (!adapter) {
      throw new Error(`Unknown source: ${sourceId}`);
    }

    return adapter;
  },

  async list() {
    await SourcesStorage.syncSources(sourceRegistry.list());

    return await runSql(list);
  },

  async search(sourceId: string, input: SourceSearchInput) {
    const adapter = SourcesService.getSourceOrThrow(sourceId);
    const result = await adapter.searchSeries(input);
    await SourcesStorage.upsertSeries(sourceId, result.items);
    return mapListResponse(sourceId, result);
  },
};
