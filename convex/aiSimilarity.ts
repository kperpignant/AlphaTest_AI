import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAllowedActionUser } from "./security";
import { embedText, EMBEDDING_DIM } from "./embeddings";

export const findSimilar = action({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    steps: v.string(),
    expectedResult: v.string(),
    description: v.optional(v.string()),
    excludeTestCaseId: v.optional(v.id("testCases")),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | {
        ok: true;
        reason: null;
        matches: Array<{
          testCaseId: Id<"testCases">;
          title: string;
          status: Doc<"testCases">["status"];
          type: Doc<"testCases">["type"];
          priority: Doc<"testCases">["priority"];
          suiteId: Id<"suites">;
          score: number;
        }>;
      }
    | { ok: false; reason: string; matches: [] }
  > => {
    const userId = await requireAllowedActionUser(ctx);
    await ctx.runQuery(internal.testCases.assertProjectAccess, {
      projectId: args.projectId,
    });

    const keys = await ctx.runQuery(internal.users.getAiKeys, { userId });
    if (!keys?.openaiApiKey) {
      return {
        ok: false as const,
        reason: "Add your OpenAI API key in Settings for similar-case search.",
        matches: [],
      };
    }

    const text = [
      `Title: ${args.title}`,
      `Description: ${args.description ?? ""}`,
      `Steps: ${args.steps}`,
      `Expected: ${args.expectedResult}`,
    ]
      .join("\n")
      .slice(0, 6000);

    const embedding = await embedText(text, keys.openaiApiKey);
    if (!embedding || embedding.length !== EMBEDDING_DIM) {
      return {
        ok: false as const,
        reason: "Could not embed the case text.",
        matches: [],
      };
    }

    const limit = Math.min(Math.max(args.limit ?? 5, 1), 10);
    const matches = await ctx.vectorSearch("testCases", "by_embedding", {
      vector: embedding,
      limit: limit + (args.excludeTestCaseId ? 1 : 0),
      filter: (q) => q.eq("projectId", args.projectId),
    });

    const enriched: Array<{
      testCaseId: Id<"testCases">;
      title: string;
      status: Doc<"testCases">["status"];
      type: Doc<"testCases">["type"];
      priority: Doc<"testCases">["priority"];
      suiteId: Id<"suites">;
      score: number;
    }> = [];

    for (const match of matches) {
      if (args.excludeTestCaseId && match._id === args.excludeTestCaseId) {
        continue;
      }
      const testCase: Doc<"testCases"> | null = await ctx.runQuery(
        internal.testCases.getInternal,
        { testCaseId: match._id },
      );
      if (!testCase) continue;
      enriched.push({
        testCaseId: testCase._id,
        title: testCase.title,
        status: testCase.status,
        type: testCase.type,
        priority: testCase.priority,
        suiteId: testCase.suiteId,
        score: match._score,
      });
      if (enriched.length >= limit) break;
    }

    return { ok: true as const, reason: null, matches: enriched };
  },
});
