import {
  char,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import type { ArtworkAnalysis } from "@/lib/artwork";
import { users } from "./users";

export const artworkSourceValues = ["pdf", "canva"] as const;

/**
 * Artwork the customer made themselves — a print PDF, or a link to a Canva
 * design that staff download — for the /upload flow. The counterpart of a
 * `designs` row for a line the editor never touched.
 *
 * Owned exactly like a design (user_id, else guest_token) and claimed the
 * same way on sign-in. An upload is immutable: choosing a different file
 * makes a new row, so an order line that points here always means this file.
 *
 * Deliberately not tied to a product or page count. What the file is checked
 * *against* is the customer's choice in step 1 and may change after the
 * upload, so the analysis below records only facts about the file
 * (src/lib/pdfAnalysis.ts) and the verdict is recomputed for each selection
 * (evaluateArtwork in src/lib/artwork.ts).
 */
export const artworkUploads = mysqlTable(
  "artwork_uploads",
  {
    id: char("id", { length: 36 }).primaryKey(),
    userId: char("user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
    guestToken: char("guest_token", { length: 36 }),
    source: mysqlEnum("source", artworkSourceValues).notNull(),
    /** The file's name as the customer chose it — what they recognise it by. */
    fileName: varchar("file_name", { length: 255 }),
    storageKey: varchar("storage_key", { length: 512 }),
    url: varchar("url", { length: 1024 }),
    byteSize: int("byte_size"),
    canvaUrl: varchar("canva_url", { length: 1024 }),
    /** What the server found in the PDF; null until the first check. */
    analysis: json("analysis").$type<ArtworkAnalysis>(),
    analysedAt: timestamp("analysed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("artwork_uploads_user_idx").on(t.userId, t.createdAt),
    index("artwork_uploads_guest_token_idx").on(t.guestToken),
  ],
);
