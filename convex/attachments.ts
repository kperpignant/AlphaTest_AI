import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireProjectAccess } from "./security";

export const listByCase = query({
  args: { testCaseId: v.id("testCases") },
  handler: async (ctx, { testCaseId }) => {
    const testCase = await ctx.db.get(testCaseId);
    if (!testCase) return [];
    await requireProjectAccess(ctx, testCase.projectId);

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_case", (q) => q.eq("testCaseId", testCaseId))
      .collect();

    return await Promise.all(
      attachments.map(async (att) => ({
        ...att,
        url: await ctx.storage.getUrl(att.storageId),
      })),
    );
  },
});

export const generateUploadUrl = mutation({
  args: { testCaseId: v.id("testCases") },
  handler: async (ctx, { testCaseId }) => {
    const testCase = await ctx.db.get(testCaseId);
    if (!testCase) throw new Error("Test case not found.");
    await requireProjectAccess(ctx, testCase.projectId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const save = mutation({
  args: {
    testCaseId: v.id("testCases"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const testCase = await ctx.db.get(args.testCaseId);
    if (!testCase) throw new Error("Test case not found.");
    const user = await requireProjectAccess(ctx, testCase.projectId);

    return await ctx.db.insert("attachments", {
      testCaseId: args.testCaseId,
      projectId: testCase.projectId,
      storageId: args.storageId,
      fileName: args.fileName,
      contentType: args.contentType,
      size: args.size,
      uploadedById: user._id,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { attachmentId: v.id("attachments") },
  handler: async (ctx, { attachmentId }) => {
    const att = await ctx.db.get(attachmentId);
    if (!att) throw new Error("Attachment not found.");
    await requireProjectAccess(ctx, att.projectId);
    await ctx.storage.delete(att.storageId);
    await ctx.db.delete(attachmentId);
  },
});
