import { pgTable, text, serial, integer, timestamp, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const performanceData = pgTable("performance_data", {
  id: serial("id").primaryKey(),
  month: timestamp("month"),
  cumulativeReturn: real("cumulative_return"),
  label: text("label"),
  value: real("value"),
  dateUpdated: timestamp("date_updated"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const statsData = pgTable("stats_data", {
  id: serial("id").primaryKey(),
  key: text("key"),
  value: real("value"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const fundsData = pgTable("funds_data", {
  id: serial("id").primaryKey(),
  key: text("key"),
  value: text("value"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const holdingsData = pgTable("holdings_data", {
  id: serial("id").primaryKey(),
  name: text("name"),
  weight: real("weight"),
  rank: integer("rank"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const exposureData = pgTable("exposure_data", {
  id: serial("id").primaryKey(),
  category: text("category"),
  name: text("name"),
  value: real("value"),
  labels: text("labels"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PerformanceData = typeof performanceData.$inferSelect;
export type InsertPerformanceData = typeof performanceData.$inferInsert;

export type StatsData = typeof statsData.$inferSelect;
export type InsertStatsData = typeof statsData.$inferInsert;

export type FundsData = typeof fundsData.$inferSelect;
export type InsertFundsData = typeof fundsData.$inferInsert;

export type HoldingsData = typeof holdingsData.$inferSelect;
export type InsertHoldingsData = typeof holdingsData.$inferInsert;

export type ExposureData = typeof exposureData.$inferSelect;
export type InsertExposureData = typeof exposureData.$inferInsert;
