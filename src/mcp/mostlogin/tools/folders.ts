import { z } from "zod";
import { ml } from "../client";

// ── Schemas ──────────────────────────────────────────────────────────

export const ListFoldersSchema = {
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .describe("Page number (default 1)"),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe("Items per page (default 10)"),
};

export const AddFolderSchema = {
  folderName: z.string().describe("Unique folder name"),
  folderColor: z
    .enum(["#3370FF", "#209E91", "#FB9247", "#00B8EB"])
    .optional()
    .default("#3370FF")
    .describe("Folder colour hex (default #3370FF)"),
  sortOrder: z
    .number()
    .int()
    .optional()
    .default(0)
    .describe("Display sort order"),
};

export const BatchDeleteFoldersSchema = {
  ids: z.array(z.string()).min(1).describe("Folder IDs to delete"),
};

export const BatchUpdateFoldersSchema = {
  folderInfos: z
    .array(
      z.object({
        id: z.string().describe("Folder ID"),
        folderName: z.string().describe("New folder name"),
        folderColor: z.string().describe("New folder colour hex"),
        sortOrder: z.number().int().describe("New sort order"),
      }),
    )
    .min(1)
    .describe("Folder objects to update"),
};

// ── Handlers ─────────────────────────────────────────────────────────

export async function listFolders(page = 1, pageSize = 10) {
  const res = await ml.post("/api/folder/list", { page, pageSize });
  return res.data;
}

export async function addFolder(
  folderName: string,
  folderColor = "#3370FF",
  sortOrder = 0,
) {
  const res = await ml.post("/api/folder/add", {
    folderName,
    folderColor,
    sortOrder,
  });
  return res.data;
}

export async function batchDeleteFolders(ids: string[]) {
  const res = await ml.post("/api/folder/batch/delete", { ids });
  return res.data;
}

export async function batchUpdateFolders(
  folderInfos: {
    id: string;
    folderName: string;
    folderColor: string;
    sortOrder: number;
  }[],
) {
  const res = await ml.post("/api/folder/batch/update", { folderInfos });
  return res.data;
}
