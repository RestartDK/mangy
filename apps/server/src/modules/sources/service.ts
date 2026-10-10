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

const list = Effect.gen(function* listEffect() {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* decodeRows(
    sourceRow,
    yield* sql`SELECT * FROM ${table("source")} ORDER BY ${column(sourceColumns, "name")} ASC`
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    websiteUrl: row.website_url,
    iconUrl: row.icon_url,
    languageCode: row.language_code,
    supportedLanguages: row.supported_languages,
    isEnabled: row.is_enabled,
    capabilities: {
      supportsPopular: row.supports_popular,
      supportsLatest: row.supports_latest,
      supportsTrending: row.supports_trending,
      supportsSearch: row.supports_search,
      supportsFilters: row.supports_filters,
      supportsSeriesDetails: row.supports_series_details,
      supportsChapterFeed: row.supports_chapter_feed,
      supportsPageFetch: row.supports_page_fetch,
    },
  }));
});

export const SourcesService = {
  async list() {
    await SourcesStorage.syncSources(sourceRegistry.list());

    return runSql(list);
  },

  getSourceOrThrow(sourceId: string) {
    const adapter = sourceRegistry.get(sourceId);
    if (!adapter) {
      throw new Error(`Unknown source: ${sourceId}`);
    }

    return adapter;
  },

  getFilters(sourceId: string): Promise<SourceFilterDefinition[]> {
    const adapter = SourcesService.getSourceOrThrow(sourceId);
    return adapter.getFilters();
  },

  async getDiscover(sourceId: string, limit?: number) {
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
  },

  async search(sourceId: string, input: SourceSearchInput) {
    const adapter = SourcesService.getSourceOrThrow(sourceId);
    const result = await adapter.searchSeries(input);
    await SourcesStorage.upsertSeries(sourceId, result.items);
    return mapListResponse(sourceId, result);
  },
};
