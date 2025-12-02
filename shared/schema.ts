import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";

export const siteData = pgTable("site_data", {
  id: serial("id").primaryKey(),
  performance: jsonb("performance"),
  stats: jsonb("stats"),
  funds: jsonb("funds"),
  holdings: jsonb("holdings"),
  exposure: jsonb("exposure"),
  text: jsonb("text"),
  dateUpdated: timestamp("date_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type SiteData = typeof siteData.$inferSelect;
export type InsertSiteData = typeof siteData.$inferInsert;
