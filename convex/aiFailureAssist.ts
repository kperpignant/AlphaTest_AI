import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAllowedActionUser } from "./security";
import { chatCompletion, parseJsonObject } from "./openRouter";

export const generate = internalAction({
  args: {
    resultId: v.id("testRunResults"),
    triggeredByUserId: v.id("users"),
  },
  handler: async (ctx, { resultId, triggeredByUserId }) => {
    await ctx.runMutation(internal.testRuns.patchAiFailure, {
      resultId,
      aiFailureAssist: { status: "generating" },
    });

    const keys = await ctx.runQuery(internal.users.getAiKeys, {
      userId: triggeredByUserId,
    });
    if (!keys?.openRouterApiKey) {
      await ctx.runMutation(internal.testRuns.patchAiFailure, {
        resultId,
        aiFailureAssist: {
          status: "failed",
          errorMessage: "Add your OpenRouter API key in Settings.",
        },
      });
      return;
    }

    const payload = await ctx.runQuery(internal.testRuns.getResultInternal, {
      resultId,
    });
    if (!payload?.result || !payload.testCase) {
      await ctx.runMutation(internal.testRuns.patchAiFailure, {
        resultId,
        aiFailureAssist: {
          status: "failed",
          errorMessage: "Result or test case missing.",
        },
      });
      return;
    }

    const { result, testCase } = payload;

    try {
      const { content, model } = await chatCompletion({
        apiKey: keys.openRouterApiKey,
        system: `You are a web QA failure analyst. Given a failed manual test, suggest likely causes,
next checks, and a concise bug report draft.
Return ONLY JSON with keys:
likelyCauses (string array), nextChecks (string array), bugReportDraft (string markdown).`,
        user: [
          `Title: ${testCase.title}`,
          `Steps:\n${testCase.steps}`,
          `Expected:\n${testCase.expectedResult}`,
          testCase.pageUrl ? `Page URL: ${testCase.pageUrl}` : "",
          result.actualResult ? `Actual:\n${result.actualResult}` : "",
          result.notes ? `Notes:\n${result.notes}` : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      });

      const parsed = parseJsonObject(content);
      const likelyCauses = Array.isArray(parsed.likelyCauses)
        ? parsed.likelyCauses.map((c) => String(c).trim()).filter(Boolean)
        : [];
      const nextChecks = Array.isArray(parsed.nextChecks)
        ? parsed.nextChecks.map((c) => String(c).trim()).filter(Boolean)
        : [];
      const bugReportDraft = String(parsed.bugReportDraft ?? "").trim();

      await ctx.runMutation(internal.testRuns.patchAiFailure, {
        resultId,
        aiFailureAssist: {
          status: "complete",
          likelyCauses,
          nextChecks,
          bugReportDraft,
          model,
          generatedAt: Date.now(),
        },
      });
    } catch (e) {
      await ctx.runMutation(internal.testRuns.patchAiFailure, {
        resultId,
        aiFailureAssist: {
          status: "failed",
          errorMessage: e instanceof Error ? e.message : "Unknown error",
        },
      });
    }
  },
});

export const regenerate = action({
  args: { resultId: v.id("testRunResults") },
  handler: async (ctx, { resultId }) => {
    const userId = await requireAllowedActionUser(ctx);
    const keys = await ctx.runQuery(internal.users.getAiKeys, { userId });
    if (!keys?.openRouterApiKey) {
      throw new Error(
        "Add your OpenRouter API key in Settings to run failure assist.",
      );
    }

    const payload = await ctx.runQuery(internal.testRuns.getResultInternal, {
      resultId,
    });
    if (!payload?.result) throw new Error("Result not found.");
    await ctx.runQuery(internal.testCases.assertProjectAccess, {
      projectId: payload.result.projectId,
    });

    await ctx.runAction(internal.aiFailureAssist.generate, {
      resultId,
      triggeredByUserId: userId,
    });
  },
});
