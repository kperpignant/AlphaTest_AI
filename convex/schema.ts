import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const caseType = v.union(
  v.literal("functional"),
  v.literal("regression"),
  v.literal("smoke"),
  v.literal("sanity"),
  v.literal("exploratory"),
  v.literal("other"),
);

const casePriority = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("critical"),
);

const caseStatus = v.union(
  v.literal("not_started"),
  v.literal("in_progress"),
  v.literal("passed"),
  v.literal("failed"),
  v.literal("blocked"),
);

const runStatus = v.union(
  v.literal("not_started"),
  v.literal("in_progress"),
  v.literal("completed"),
);

const resultStatus = v.union(
  v.literal("not_started"),
  v.literal("passed"),
  v.literal("failed"),
  v.literal("blocked"),
  v.literal("skipped"),
);

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    /** Per-user OpenRouter key. Never return to clients. */
    openRouterApiKey: v.optional(v.string()),
    /** Per-user OpenAI key for embeddings. Never return to clients. */
    openaiApiKey: v.optional(v.string()),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("email", ["email"]),

  projects: defineTable({
    name: v.string(),
    key: v.string(),
    description: v.optional(v.string()),
    createdById: v.id("users"),
    createdAt: v.number(),
    archivedAt: v.optional(v.number()),
  }).index("by_key", ["key"]),

  projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_project_and_user", ["projectId", "userId"]),

  suites: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]),

  testCases: defineTable({
    projectId: v.id("projects"),
    suiteId: v.id("suites"),
    title: v.string(),
    description: v.optional(v.string()),
    steps: v.string(),
    expectedResult: v.string(),
    preconditions: v.optional(v.string()),
    estimate: v.optional(v.string()),
    type: caseType,
    priority: casePriority,
    labels: v.optional(v.array(v.string())),
    assigneeId: v.optional(v.id("users")),
    status: caseStatus,
    pageUrl: v.optional(v.string()),
    browserNotes: v.optional(v.string()),
    embedding: v.optional(v.array(v.number())),
    embeddingModel: v.optional(v.string()),
    embeddedAt: v.optional(v.number()),
    createdById: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_suite", ["suiteId"])
    .index("by_assignee", ["assigneeId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["projectId"],
    }),

  testRuns: defineTable({
    projectId: v.id("projects"),
    suiteId: v.optional(v.id("suites")),
    name: v.string(),
    description: v.optional(v.string()),
    status: runStatus,
    createdById: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_suite", ["suiteId"]),

  testRunResults: defineTable({
    testRunId: v.id("testRuns"),
    testCaseId: v.id("testCases"),
    projectId: v.id("projects"),
    status: resultStatus,
    notes: v.optional(v.string()),
    actualResult: v.optional(v.string()),
    executedById: v.optional(v.id("users")),
    executedAt: v.optional(v.number()),
    sortOrder: v.number(),
    aiFailureAssist: v.optional(
      v.object({
        status: v.union(
          v.literal("pending"),
          v.literal("generating"),
          v.literal("complete"),
          v.literal("failed"),
        ),
        likelyCauses: v.optional(v.array(v.string())),
        nextChecks: v.optional(v.array(v.string())),
        bugReportDraft: v.optional(v.string()),
        errorMessage: v.optional(v.string()),
        model: v.optional(v.string()),
        generatedAt: v.optional(v.number()),
      }),
    ),
  })
    .index("by_run", ["testRunId"])
    .index("by_case", ["testCaseId"])
    .index("by_run_and_case", ["testRunId", "testCaseId"]),

  attachments: defineTable({
    testCaseId: v.id("testCases"),
    projectId: v.id("projects"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.string(),
    size: v.number(),
    uploadedById: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_case", ["testCaseId"])
    .index("by_project", ["projectId"]),
});
