// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

// convex-test needs to discover the function modules. import.meta.glob is
// provided by Vite's transform and lists every module under convex/.
// Cast because the Convex tsconfig (tsc) lacks Vite's ImportMeta typings;
// vitest provides `glob` at runtime.
const modules = (
  import.meta as unknown as {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
).glob("./**/*.ts");

const ISSUER = "https://clerk.scoreeasy.test";

async function seedUser(
  t: ReturnType<typeof convexTest>,
  tokenIdentifier: string,
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      tokenIdentifier,
      createdAt: Date.now(),
    }),
  );
}

function identityFor(tokenIdentifier: string, subject: string) {
  return { tokenIdentifier, subject, issuer: ISSUER };
}

const TEAMS = {
  teamA: { name: "Falcons" },
  teamB: { name: "Hawks" },
};

function newClient() {
  return convexTest(schema, modules);
}

describe("live.create", () => {
  test("returns an unguessable token and a matchId", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));

    const res = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-create-1",
    });

    expect(res.matchId).toBeTruthy();
    expect(typeof res.token).toBe("string");
    expect(res.token.length).toBeGreaterThanOrEqual(16);
    // base32 alphabet only — no padding, no lowercase.
    expect(res.token).toMatch(/^[A-Z2-7]+$/);
  });

  test("is idempotent on clientMatchId (same token reused)", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));

    const first = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-dup",
    });
    const second = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-dup",
    });

    expect(second.matchId).toBe(first.matchId);
    expect(second.token).toBe(first.token);
  });
});

describe("live.scorePoint", () => {
  test("increments the snapshot and the running event totals", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));

    const { matchId, token } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-score",
    });

    await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "e1",
      team: "A",
      at: 1000,
    });
    const ev2 = await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "e2",
      team: "A",
      at: 2000,
    });

    expect(ev2).not.toBeNull();
    expect(ev2!.seq).toBe(2);
    expect(ev2!.runningA).toBe(2);
    expect(ev2!.runningB).toBe(0);

    const snap = await t.query(api.live.getByToken, { token });
    expect(snap?.pointsA).toBe(2);
    expect(snap?.pointsB).toBe(0);
    expect(snap?.lastSeq).toBe(2);
  });

  test("supports a custom point value", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { matchId, token } = await asOwner.mutation(api.live.create, {
      sport: "rugby",
      scorecardKind: "generic",
      ...TEAMS,
      clientMatchId: "cm-val",
    });

    await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "try1",
      team: "B",
      value: 5,
      at: 10,
    });

    const snap = await t.query(api.live.getByToken, { token });
    expect(snap?.pointsB).toBe(5);
  });

  test("is idempotent on a repeated clientEventId (no double count)", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { matchId, token } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-idem",
    });

    const a = await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "dup-event",
      team: "A",
      at: 1,
    });
    const b = await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "dup-event",
      team: "A",
      at: 2,
    });

    // Same event row returned; no second append.
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(b!._id).toBe(a!._id);
    expect(b!.seq).toBe(1);

    const snap = await t.query(api.live.getByToken, { token });
    expect(snap?.pointsA).toBe(1);
    expect(snap?.lastSeq).toBe(1);
  });
});

describe("live.undo", () => {
  test("reverses the last active point", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { matchId, token } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-undo",
    });

    await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "p1",
      team: "A",
      at: 1,
    });
    await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "p2",
      team: "A",
      at: 2,
    });

    const undoEv = await asOwner.mutation(api.live.undo, {
      matchId,
      clientEventId: "u1",
      at: 3,
    });
    expect(undoEv).not.toBeNull();
    expect(undoEv!.type).toBe("undo");
    expect(undoEv!.runningA).toBe(1);

    const snap = await t.query(api.live.getByToken, { token });
    expect(snap?.pointsA).toBe(1);
    expect(snap?.lastSeq).toBe(3);
  });

  test("is idempotent on clientEventId", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { matchId, token } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-undo2",
    });
    await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "p1",
      team: "A",
      at: 1,
    });
    const first = await asOwner.mutation(api.live.undo, {
      matchId,
      clientEventId: "u-dup",
      at: 2,
    });
    const second = await asOwner.mutation(api.live.undo, {
      matchId,
      clientEventId: "u-dup",
      at: 3,
    });
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second!._id).toBe(first!._id);

    const snap = await t.query(api.live.getByToken, { token });
    expect(snap?.pointsA).toBe(0);
  });
});

describe("live.getByToken — §7.2 data-minimization whitelist", () => {
  test("returns ONLY whitelisted fields — ownerId & token are absent", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { token } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-whitelist",
    });

    const snap = await t.query(api.live.getByToken, { token });
    expect(snap).not.toBeNull();
    const keys = Object.keys(snap!).sort();
    expect(keys).toEqual(
      [
        "currentUnit",
        "isYouthMatch",
        "lastEventAt",
        "lastSeq",
        "pointsA",
        "pointsB",
        "scorecardKind",
        "setScores",
        "setsA",
        "setsB",
        "sport",
        "startedAt",
        "status",
      ].sort(),
    );

    // The security-critical assertions: secrets never leak.
    expect(snap).not.toHaveProperty("ownerId");
    expect(snap).not.toHaveProperty("token");
    expect(snap).not.toHaveProperty("_id");
    expect(snap).not.toHaveProperty("clientMatchId");
    expect(snap).not.toHaveProperty("moderationStatus");
    expect(snap).not.toHaveProperty("feedRank");
  });

  test("returns null for an unknown token (no enumeration leak)", async () => {
    const t = newClient();
    const snap = await t.query(api.live.getByToken, { token: "NOPE234567" });
    expect(snap).toBeNull();
  });
});

describe("live ownership enforcement", () => {
  test("a different identity CANNOT scorePoint (owner-only)", async () => {
    const t = newClient();
    // Seed BOTH users so the attacker passes auth and is rejected on ownership,
    // not on "User not found".
    await seedUser(t, "owner|1");
    await seedUser(t, "attacker|2");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const asAttacker = t.withIdentity(identityFor("attacker|2", "attacker-2"));

    const { matchId } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-owner",
    });

    await expect(
      asAttacker.mutation(api.live.scorePoint, {
        matchId,
        clientEventId: "x1",
        team: "A",
        at: 1,
      }),
    ).rejects.toThrow(/Not authorized/);
  });
});

describe("live event reads", () => {
  test("eventsSince returns only events with seq > sinceSeq, ordered by seq", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { matchId, token } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-since",
    });

    for (let i = 1; i <= 3; i += 1) {
      await asOwner.mutation(api.live.scorePoint, {
        matchId,
        clientEventId: `e${i}`,
        team: "A",
        at: i,
      });
    }

    const since1 = await t.query(api.live.eventsSince, {
      token,
      sinceSeq: 1,
    });
    expect(since1.map((e) => e.seq)).toEqual([2, 3]);

    const sinceAll = await t.query(api.live.eventsSince, {
      token,
      sinceSeq: 3,
    });
    expect(sinceAll).toEqual([]);

    // §7.2: operator-only fields MUST NOT leak in the public event stream.
    for (const e of since1) {
      expect(e).not.toHaveProperty("clientEventId");
      expect(e).not.toHaveProperty("meta");
      expect(e).not.toHaveProperty("playerId");
    }
  });

  test("listEvents paginates by seq", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { matchId, token } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-page",
    });

    for (let i = 1; i <= 5; i += 1) {
      await asOwner.mutation(api.live.scorePoint, {
        matchId,
        clientEventId: `e${i}`,
        team: i % 2 === 0 ? "A" : "B",
        at: i,
      });
    }

    // DESC: first page is the NEWEST events (live tail), loadMore pages backward.
    const page1 = await t.query(api.live.listEvents, {
      token,
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(page1.page.length).toBe(2);
    expect(page1.page.map((e: { seq: number }) => e.seq)).toEqual([5, 4]);
    expect(page1.isDone).toBe(false);

    // §7.2: operator-only fields MUST NOT leak in the paginated event stream.
    for (const e of page1.page) {
      expect(e).not.toHaveProperty("clientEventId");
      expect(e).not.toHaveProperty("meta");
      expect(e).not.toHaveProperty("playerId");
    }

    const page2 = await t.query(api.live.listEvents, {
      token,
      paginationOpts: { numItems: 10, cursor: page1.continueCursor },
    });
    expect(page2.page.map((e: { seq: number }) => e.seq)).toEqual([3, 2, 1]);
    expect(page2.isDone).toBe(true);
  });
});

describe("live read gating — private & removed return nothing", () => {
  test("private match is null/empty from token-gated reads", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { matchId, token } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-private",
    });
    await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "e1",
      team: "A",
      at: 1,
    });

    // Make it private via the owner mutation.
    await asOwner.mutation(api.live.setVisibility, {
      matchId,
      visibility: "private",
    });

    expect(await t.query(api.live.getByToken, { token })).toBeNull();
    expect(await t.query(api.live.getMeta, { token })).toBeNull();
    expect(
      await t.query(api.live.eventsSince, { token, sinceSeq: 0 }),
    ).toEqual([]);
    const page = await t.query(api.live.listEvents, {
      token,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page).toEqual([]);
  });

  test("removed (moderated-out) match is null/empty from token-gated reads", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { matchId, token } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-removed",
    });
    await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "e1",
      team: "A",
      at: 1,
    });

    // No mutation exposes moderation; patch directly.
    await t.run(async (ctx) =>
      ctx.db.patch(matchId, { moderationStatus: "removed" }),
    );

    expect(await t.query(api.live.getByToken, { token })).toBeNull();
    expect(await t.query(api.live.getMeta, { token })).toBeNull();
    expect(
      await t.query(api.live.eventsSince, { token, sinceSeq: 0 }),
    ).toEqual([]);
    const page = await t.query(api.live.listEvents, {
      token,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page).toEqual([]);
  });
});

describe("live.finalize — winner uses sets as primary, points as tiebreaker", () => {
  test("setsA=1,setsB=2,pointsA=50,pointsB=40 → team B (Hawks) wins", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { matchId } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-finalize-winner",
    });

    // Drive the snapshot to the tricky state: B has MORE sets but FEWER points.
    await t.run(async (ctx) =>
      ctx.db.patch(matchId, {
        setsA: 1,
        setsB: 2,
        pointsA: 50,
        pointsB: 40,
      }),
    );

    const res = await asOwner.mutation(api.live.finalize, { matchId });
    expect(res.archived).toBe(true);

    // matchId is non-null for a set sport (cricket is the only skip path, 6tf).
    const archived = await t.run(async (ctx) => ctx.db.get(res.matchId!));
    // Sets are primary → B (Hawks) wins despite fewer current points.
    expect(archived?.winner).toBe(TEAMS.teamB.name);
    // 87d: a set-based match archives its SET tally as the headline score, not
    // the last-set points (50/40) — so History shows "1–2 sets", consistent
    // with the sets-primary winner.
    expect(archived?.score1).toBe(1);
    expect(archived?.score2).toBe(2);
  });
});

describe("live.scorePoint — operator snapshot push (87d, sets-sports)", () => {
  test("a snapshot patches sets/serving/setScores and drives the headline from current-set points", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { matchId, token } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-snap",
    });

    const ev = await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "s1",
      team: "A",
      at: 1000,
      snapshot: {
        pointsA: 1,
        pointsB: 0,
        setsA: 1,
        setsB: 0,
        setScores: [{ a: 25, b: 20 }],
        servingTeam: "B",
        currentUnit: 2,
        periodLabel: "Set 2",
      },
    });

    // Event running totals + sets come from the snapshot, not stale match.*.
    expect(ev!.runningA).toBe(1);
    expect(ev!.setsA).toBe(1);
    expect(ev!.servingAfter).toBe("B");

    const snap = await t.query(api.live.getByToken, { token });
    expect(snap).toMatchObject({
      pointsA: 1,
      pointsB: 0,
      setsA: 1,
      setsB: 0,
      setScores: [{ a: 25, b: 20 }],
      servingTeam: "B",
      currentUnit: 2,
      periodLabel: "Set 2",
    });
  });

  test("the snapshot is ABSOLUTE — a set reset lowers the headline points (no cumulative arithmetic)", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { matchId, token } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-reset",
    });

    // Mid first set.
    await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "p1",
      team: "B",
      at: 1,
      snapshot: { pointsA: 24, pointsB: 26, setsA: 0, setsB: 0, setScores: [], currentUnit: 1 },
    });
    // The set ends (B 26-24) → next set starts 0-0 with B leading 1-0 in sets.
    const ev2 = await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "p2",
      team: "B",
      at: 2,
      snapshot: { pointsA: 0, pointsB: 0, setsA: 0, setsB: 1, setScores: [{ a: 24, b: 26 }], currentUnit: 2 },
    });

    expect(ev2!.runningA).toBe(0);
    expect(ev2!.runningB).toBe(0);
    const snap = await t.query(api.live.getByToken, { token });
    expect(snap?.pointsA).toBe(0);
    expect(snap?.pointsB).toBe(0);
    expect(snap?.setsB).toBe(1);
    expect(snap?.setScores).toEqual([{ a: 24, b: 26 }]);
  });

  test("undo accepts a snapshot and restores set-boundary state from it", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { matchId, token } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-undo-snap",
    });
    await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "p1",
      team: "A",
      at: 1,
      snapshot: { pointsA: 25, pointsB: 23, setsA: 1, setsB: 0, setScores: [{ a: 25, b: 23 }], currentUnit: 2 },
    });

    // Undo the set-winning point → back to 24-23, set NOT yet won.
    const undoEv = await asOwner.mutation(api.live.undo, {
      matchId,
      clientEventId: "u1",
      at: 2,
      snapshot: { pointsA: 24, pointsB: 23, setsA: 0, setsB: 0, setScores: [], currentUnit: 1 },
    });

    expect(undoEv!.type).toBe("undo");
    expect(undoEv!.runningA).toBe(24);
    const snap = await t.query(api.live.getByToken, { token });
    expect(snap?.pointsA).toBe(24);
    expect(snap?.setsA).toBe(0);
    expect(snap?.setScores).toEqual([]);
  });
});

describe("live write guards — reject writes to a finalized match (87d)", () => {
  test("scorePoint on a final match throws, but a retried clientEventId returns the prior event", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { matchId } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-final-guard",
    });
    const p1 = await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "p1",
      team: "A",
      at: 1,
    });
    await asOwner.mutation(api.live.finalize, { matchId });

    // A brand-new event after finalize is rejected.
    await expect(
      asOwner.mutation(api.live.scorePoint, {
        matchId,
        clientEventId: "after-final",
        team: "A",
        at: 2,
      }),
    ).rejects.toThrow(/final/i);

    // A retried (already-recorded) event still returns its prior row — replay-safe.
    const replay = await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "p1",
      team: "A",
      at: 1,
    });
    expect(replay!._id).toBe(p1!._id);
  });

  test("undo on a final match throws", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { matchId } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-final-undo",
    });
    await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "p1",
      team: "A",
      at: 1,
    });
    await asOwner.mutation(api.live.finalize, { matchId });

    await expect(
      asOwner.mutation(api.live.undo, { matchId, clientEventId: "u-after", at: 2 }),
    ).rejects.toThrow(/final/i);
  });
});

describe("live.finalize — cricket defers archive to the local scorer (6tf)", () => {
  test("a cricket match is NOT archived into matches by finalize", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { matchId, token } = await asOwner.mutation(api.live.create, {
      sport: "cricket",
      scorecardKind: "cricket",
      ...TEAMS,
      clientMatchId: "cm-cricket-final",
    });
    await asOwner.mutation(api.live.scorePoint, {
      matchId,
      clientEventId: "r1",
      team: "A",
      value: 4,
      at: 1,
      snapshot: { pointsA: 4, pointsB: 0, setsA: 0, setsB: 0, setScores: [], currentUnit: 1 },
    });

    const res = await asOwner.mutation(api.live.finalize, { matchId });

    // Skipped the archive — the local cricket scorer owns the matches row.
    expect(res.archived).toBe(false);
    expect(res.matchId).toBeNull();
    const matches = await t.run(async (ctx) => ctx.db.query("matches").collect());
    expect(matches.length).toBe(0);

    // The live match still finalized (status final) so the spectator view closes.
    const snap = await t.query(api.live.getByToken, { token });
    expect(snap?.status).toBe("final");
  });

  test("a non-cricket (volleyball) match IS still archived by finalize", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { matchId } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-vb-final",
    });
    await t.run(async (ctx) => ctx.db.patch(matchId, { setsA: 3, setsB: 1 }));

    const res = await asOwner.mutation(api.live.finalize, { matchId });
    expect(res.archived).toBe(true);
    const matches = await t.run(async (ctx) => ctx.db.query("matches").collect());
    expect(matches.length).toBe(1);
  });
});

describe("live moderation floor (q7k)", () => {
  test("a profane team name holds the match and hides it from public reads", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { token, matchId } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      teamA: { name: "Shit FC" },
      teamB: { name: "Hawks" },
      clientMatchId: "cm-profane",
    });

    const held = await t.run(async (ctx) => ctx.db.get(matchId));
    expect(held?.moderationStatus).toBe("held");
    // Hidden from every public reader while held.
    expect(await t.query(api.live.getByToken, { token })).toBeNull();
    expect(await t.query(api.live.getMeta, { token })).toBeNull();
  });

  test("a clean match is public", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { token, matchId } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-clean",
    });
    expect((await t.run((ctx) => ctx.db.get(matchId)))?.moderationStatus).toBe("clean");
    expect(await t.query(api.live.getByToken, { token })).not.toBeNull();
  });

  test("auto-expire hides a finalized match past its grace window", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { token, matchId } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-expire",
    });
    expect(await t.query(api.live.getByToken, { token })).not.toBeNull();
    // Force expiry into the past.
    await t.run((ctx) => ctx.db.patch(matchId, { publicExpiresAt: Date.now() - 1 }));
    expect(await t.query(api.live.getByToken, { token })).toBeNull();
  });

  test("report FLAGS (never hides) at the distinct-reporter threshold; dedups per reporter", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    const { token, matchId } = await asOwner.mutation(api.live.create, {
      sport: "volleyball",
      scorecardKind: "volleyball",
      ...TEAMS,
      clientMatchId: "cm-report",
    });

    // Same reporter spamming counts once → only 2 distinct reporters so far.
    await t.mutation(api.live.report, { token, reason: "abuse", reporterId: "r1" });
    await t.mutation(api.live.report, { token, reason: "abuse", reporterId: "r1" });
    await t.mutation(api.live.report, { token, reason: "abuse", reporterId: "r2" });
    expect((await t.run((ctx) => ctx.db.get(matchId)))?.flaggedAt).toBeUndefined();

    // A 3rd DISTINCT reporter crosses the threshold → FLAGGED for review, but the
    // match stays publicly visible (reports must never auto-takedown content).
    const res = await t.mutation(api.live.report, { token, reason: "hate", reporterId: "r3" });
    expect(res.ok).toBe(true);
    expect(await t.query(api.live.getByToken, { token })).not.toBeNull(); // still public
    const flagged = await t.run((ctx) => ctx.db.get(matchId));
    expect(typeof flagged?.flaggedAt).toBe("number");
    expect(flagged?.moderationStatus).toBe("clean"); // NOT held

    // Dedup: r1's two reports are one row → 3 rows for r1/r2/r3, not 4.
    const rows = await t.run((ctx) =>
      ctx.db.query("moderationReports").withIndex("by_match", (q) => q.eq("matchId", matchId)).collect(),
    );
    expect(rows.length).toBe(3);
  });

  test("report on an unknown token is uniform and records nothing (no enumeration leak)", async () => {
    const t = newClient();
    const res = await t.mutation(api.live.report, {
      token: "NOPE234567",
      reason: "spam",
      reporterId: "r1",
    });
    expect(res.ok).toBe(true);
    const rows = await t.run((ctx) => ctx.db.query("moderationReports").collect());
    expect(rows.length).toBe(0);
  });

  test("create is rate-capped per owner", async () => {
    const t = newClient();
    await seedUser(t, "owner|1");
    const asOwner = t.withIdentity(identityFor("owner|1", "owner-1"));
    // 21 creates succeed (cap is 20 EXISTING before a create is blocked).
    for (let i = 0; i <= 20; i += 1) {
      await asOwner.mutation(api.live.create, {
        sport: "volleyball",
        scorecardKind: "volleyball",
        ...TEAMS,
        clientMatchId: `cap-${i}`,
      });
    }
    await expect(
      asOwner.mutation(api.live.create, {
        sport: "volleyball",
        scorecardKind: "volleyball",
        ...TEAMS,
        clientMatchId: "cap-over",
      }),
    ).rejects.toThrow(/rate limit/i);
  });
});
