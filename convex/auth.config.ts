export default {
  providers: [
    {
      // Set on the Convex deployment:
      //   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-clerk-domain.clerk.accounts.dev
      domain:
        (globalThis as { process?: { env?: Record<string, string | undefined> } })
          .process?.env?.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
