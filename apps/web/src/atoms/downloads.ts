import { ApiAtoms } from "@/atoms/client";
import { reactivityKey } from "@/atoms/keys";

export type { DownloadJob as DownloadItem } from "@mangy/contract";

export const downloadsQuery = ApiAtoms.query("downloads", "list", {
  reactivityKeys: [reactivityKey.downloads],
});

export const cancelDownload = ApiAtoms.mutation("downloads", "cancel");

export const retryDownload = ApiAtoms.mutation("downloads", "retry");
