import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

function buildEmbeddingText(testCase: {
  title: string;
  description?: string;
  steps: string;
  expectedResult: string;
  labels?: string[];
}): string {
  const parts = [
    `Title: ${testCase.title}`,
    `Description: ${testCase.description ?? ""}`,
    `Steps: ${testCase.steps}`,
    `Expected: ${testCase.expectedResult}`,
  ];
  if (testCase.labels?.length) {
    parts.push(`Labels: ${testCase.labels.join(", ")}`);
  }
  return parts.join("\n").slice(0, 6000);
}

export async function embedText(
  text: string,
  apiKey: string | null | undefined,
): Promise<number[] | null> {
  if (!apiKey) return null;
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `OpenAI embeddings HTTP ${res.status}: ${body.slice(0, 300)}`,
    );
  }
  const data = (await res.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const vec = data.data?.[0]?.embedding;
  if (!vec || vec.length !== EMBEDDING_DIM) {
    throw new Error(
      `Unexpected embedding response (got ${vec?.length ?? 0} dims, expected ${EMBEDDING_DIM})`,
    );
  }
  return vec;
}

export const getCaseForEmbedding = internalQuery({
  args: { testCaseId: v.id("testCases") },
  handler: async (ctx, { testCaseId }) => {
    const testCase = await ctx.db.get(testCaseId);
    if (!testCase) return null;
    return {
      _id: testCase._id,
      projectId: testCase.projectId,
      title: testCase.title,
      description: testCase.description,
      steps: testCase.steps,
      expectedResult: testCase.expectedResult,
      labels: testCase.labels,
    };
  },
});

export const saveEmbedding = internalMutation({
  args: {
    testCaseId: v.id("testCases"),
    embedding: v.array(v.number()),
    model: v.string(),
  },
  handler: async (ctx, { testCaseId, embedding, model }) => {
    const existing = await ctx.db.get(testCaseId);
    if (!existing) return;
    await ctx.db.patch(testCaseId, {
      embedding,
      embeddingModel: model,
      embeddedAt: Date.now(),
    });
  },
});

export const embedTestCase = internalAction({
  args: {
    testCaseId: v.id("testCases"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, { testCaseId, userId }) => {
    let apiKey: string | null = null;
    if (userId) {
      const keys = await ctx.runQuery(internal.users.getAiKeys, { userId });
      apiKey = keys?.openaiApiKey ?? null;
    }
    if (!apiKey) return;

    const testCase = await ctx.runQuery(
      internal.embeddings.getCaseForEmbedding,
      { testCaseId },
    );
    if (!testCase) return;

    try {
      const embedding = await embedText(buildEmbeddingText(testCase), apiKey);
      if (!embedding) return;
      await ctx.runMutation(internal.embeddings.saveEmbedding, {
        testCaseId,
        embedding,
        model: EMBEDDING_MODEL,
      });
    } catch (e) {
      console.error("embedTestCase failed", e);
    }
  },
});

export const listCasesNeedingEmbedding = internalQuery({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, { projectId }) => {
    const cases = projectId
      ? await ctx.db
          .query("testCases")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .collect()
      : await ctx.db.query("testCases").collect();
    return cases
      .filter(
        (c: Doc<"testCases">) =>
          !c.embedding || c.embeddingModel !== EMBEDDING_MODEL,
      )
      .map((c: Doc<"testCases">) => c._id as Id<"testCases">);
  },
});
