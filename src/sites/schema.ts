import { z } from "zod";

const flowFlagsSchema = z
  .object({
    browseHomepage: z.boolean(),
    explorePricing: z.boolean(),
    browseFooterLinks: z.boolean(),
    login: z.boolean(),
    accountDashboard: z.boolean(),
  })
  .strict();

const browseHomepageSchema = z
  .object({
    homePath: z.string().min(1),
    heroHeadingSelector: z.string().min(1),
    heroHeadingIncludes: z.array(z.string()),
    navLinksSelector: z.string().min(1),
    expectedAnchors: z.array(z.string()),
    academySectionSelector: z.string().min(1),
    academyFeatureSelectors: z.array(z.string()).min(1),
    ritualsSectionSelector: z.string().nullable(),
    membersSectionSelector: z.string().min(1),
    pricingLinksSelector: z.string().min(1),
    pricingPlanRegex: z.string().min(1),
    footerLinksSelector: z.string().min(1),
    requiredFooterPaths: z.array(z.string()),
  })
  .strict();

const browseFooterLinksSchema = z
  .object({
    homePath: z.string().min(1),
    footerPaths: z.array(z.string()),
    footerContainerSelector: z.string().min(1),
    footerLinkSelectorTemplate: z.string().min(1),
    headingSelector: z.string().min(1),
  })
  .strict();

const loginSchema = z
  .object({
    loginPath: z.string().min(1),
    loginFormSelector: z.string().min(1),
    openLoginSelector: z.string().nullable(),
    submitResponseUrlIncludes: z.string().nullable(),
    emailSelector: z.string().min(1),
    passwordSelector: z.string().min(1),
    submitSelector: z.string().min(1),
    errorSelector: z.string().min(1),
    failureUrlIncludes: z.array(z.string()),
    successUrlIncludes: z.array(z.string()),
  })
  .strict();

const explorePricingSchema = z
  .object({
    pricingPath: z.string().min(1),
    pricingSectionSelector: z.string().min(1),
    tierNameSelectors: z.array(z.string()).min(1),
    ctaSelector: z.string().min(1),
    ctaMustContain: z.string().min(1),
    signupExpectedPathIncludes: z.string().min(1),
    emailSelector: z.string().min(1),
    nameSelector: z.string().min(1),
    passwordSelector: z.string().min(1),
    syntheticNamePrefix: z.string().min(1),
    syntheticPassword: z.string().min(1),
  })
  .strict();

const accountDashboardSchema = z
  .object({
    dashboardPath: z.string().min(1),
    mustNotIncludePaths: z.array(z.string()),
    mustIncludePathFragment: z.string().min(1),
    mainSelector: z.string().min(1),
    balanceSelectors: z.array(z.string()).min(1),
    paymentPresenceSelector: z.string().min(1),
    appLinkSelector: z.string().min(1),
    appLinkIncludes: z.string().min(1),
    appLinkExcludes: z.array(z.string()),
  })
  .strict();

const sessionSchema = z
  .object({
    seedCandidates: z.array(z.string()).min(1),
  })
  .strict();

export const siteProfileSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    baseUrl: z.string().url(),
    enabledFlows: flowFlagsSchema,
    session: sessionSchema,
    browseHomepage: browseHomepageSchema,
    browseFooterLinks: browseFooterLinksSchema,
    login: loginSchema,
    explorePricing: explorePricingSchema,
    accountDashboard: accountDashboardSchema,
  })
  .strict();

export type SiteProfile = z.infer<typeof siteProfileSchema>;
export type FlowFlag = keyof SiteProfile["enabledFlows"];
