import { v } from "convex/values";
export const periodClockValidator = v.object({
  sport: v.string(), phase: v.union(v.literal("playing"), v.literal("interval"), v.literal("finished")),
  elapsed: v.number(), startedAt: v.union(v.number(), v.null()), duration: v.number(), periodIndex: v.number(), regulationCount: v.number(),
});
export type PeriodClock = { sport: string; phase: "playing" | "interval" | "finished"; elapsed: number; startedAt: number | null; duration: number; periodIndex: number; regulationCount: number };
