import { v } from 'convex/values';

export const matchFields = {
  sport: v.string(), team1: v.string(), team2: v.string(),
  score1: v.number(), score2: v.number(),
  detail: v.optional(v.any()), winner: v.optional(v.string()),
  resultType: v.optional(v.union(v.literal('decided'), v.literal('abandoned'))),
  format: v.optional(v.any()), operatedBy: v.id('users'), date: v.number(),
  duration: v.optional(v.number()), team1Id: v.optional(v.id('teams')),
  team2Id: v.optional(v.id('teams')), matchRole: v.optional(v.string()),
  clientMatchId: v.optional(v.string()), token: v.optional(v.string()),
  eventBlobId: v.optional(v.id('_storage')), eventCount: v.optional(v.number()),
  finalizedReason: v.optional(v.string()),
};

export const matchDocument = v.object({
  _id: v.id('matches'), _creationTime: v.number(), ...matchFields,
});
