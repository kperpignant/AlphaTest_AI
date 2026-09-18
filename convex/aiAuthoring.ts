import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAllowedActionUser } from "./security";
import { chatCompletion, parseJsonObject } from "./openRouter";

const CASE_TYPES = [
  "functional",
  "regression",
  "smoke",
  "sanity",
  "exploratory",
  "other",
] as const;

const PRIORITIES = ["low", "medium", "high", "critical"] as const;

export const draftCase = action({
  args: {
    projectId: v.id("projects"),
    prompt: v.string(),
    pageUrl: v.optional(v.string()),
    extraContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAllowedActionUser(ctx);
    await ctx.runQuery(internal.testCases.assertProjectAccess, {
      projectId: args.projectId,
    });

    const keys = await ctx.runQuery(internal.users.getAiKeys, { userId });
    if (!keys?.openRouterApiKey) {
      throw new Error(
        "Add your OpenRouter API key in Settings to generate test cases.",
      );
    }

    const prompt = args.prompt.trim();
    if (!prompt) throw new Error("Describe what you want to test.");

    const { content, model } = await chatCompletion({
      apiKey: keys.openRouterApiKey,
      system: `You are a senior web QA engineer. Draft a clear manual test case for a web application.
Return ONLY JSON with keys:
title (string), description (string), preconditions (string), steps (string, numbered lines),
expectedResult (string), type (one of ${CASE_TYPES.join("|")}),
priority (one of ${PRIORITIES.join("|")}), labels (string array),
pageUrl (string or empty), browserNotes (string or empty).`,
      user: [
        `Request: ${prompt}`,
        args.pageUrl ? `Page URL: ${args.pageUrl}` : "",
        args.extraContext ? `Context: ${args.extraContext}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    const parsed = parseJsonObject(content);
    const typeRaw = String(parsed.type ?? "functional");
    const priorityRaw = String(parsed.priority ?? "medium");
    const type = CASE_TYPES.includes(typeRaw as (typeof CASE_TYPES)[number])
      ? (typeRaw as (typeof CASE_TYPES)[number])
      : "functional";
    const priority = PRIORITIES.includes(
      priorityRaw as (typeof PRIORITIES)[number],
    )
      ? (priorityRaw as (typeof PRIORITIES)[number])
      : "medium";

    const labels = Array.isArray(parsed.labels)
      ? parsed.labels.map((l) => String(l).trim()).filter(Boolean)
      : [];

    return {
      title: String(parsed.title ?? "").trim() || "Untitled case",
      description: String(parsed.description ?? "").trim(),
      preconditions: String(parsed.preconditions ?? "").trim(),
      steps: String(parsed.steps ?? "").trim(),
      expectedResult: String(parsed.expectedResult ?? "").trim(),
      type,
      priority,
      labels,
      pageUrl:
        String(parsed.pageUrl ?? "").trim() || args.pageUrl?.trim() || "",
      browserNotes: String(parsed.browserNotes ?? "").trim(),
      model,
    };
  },
});
