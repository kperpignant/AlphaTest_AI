/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiAuthoring from "../aiAuthoring.js";
import type * as aiFailureAssist from "../aiFailureAssist.js";
import type * as aiSimilarity from "../aiSimilarity.js";
import type * as attachments from "../attachments.js";
import type * as embeddings from "../embeddings.js";
import type * as openRouter from "../openRouter.js";
import type * as projects from "../projects.js";
import type * as security from "../security.js";
import type * as suites from "../suites.js";
import type * as testCases from "../testCases.js";
import type * as testRuns from "../testRuns.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiAuthoring: typeof aiAuthoring;
  aiFailureAssist: typeof aiFailureAssist;
  aiSimilarity: typeof aiSimilarity;
  attachments: typeof attachments;
  embeddings: typeof embeddings;
  openRouter: typeof openRouter;
  projects: typeof projects;
  security: typeof security;
  suites: typeof suites;
  testCases: typeof testCases;
  testRuns: typeof testRuns;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
