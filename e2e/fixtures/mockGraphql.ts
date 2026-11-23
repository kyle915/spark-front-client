import type { Page, Route } from "@playwright/test";

export type MockPersona = "admin-multi" | "client-single";

export interface MockGraphqlOptions {
  persona?: MockPersona;
  /** Initial active tenant UUID. */
  activeTenantUuid?: string;
}

const TENANT_A = {
  id: "VGVuYW50OjEwMQ==",
  uuid: "11111111-1111-4111-8111-111111111111",
  name: "Spark Demo Beverage",
  requestUrlName: "Spark Demo Beverage",
  tenantSlug: "spark-demo-beverage",
  checkinCode: "SD-DEMO01",
  image: null,
};

const TENANT_B = {
  id: "VGVuYW50OjEwMg==",
  uuid: "22222222-2222-4222-8222-222222222222",
  name: "Summit Cold Brew",
  requestUrlName: "Summit Cold Brew",
  tenantSlug: "summit-cold-brew",
  checkinCode: "SC-DEMO02",
  image: null,
};

const TENANT_ARCHIVED = {
  id: "VGVuYW50OjEwMw==",
  uuid: "33333333-3333-4333-8333-333333333333",
  name: "[ARCHIVED] Legacy Drink Co",
  requestUrlName: "[ARCHIVED] Legacy Drink Co",
  tenantSlug: "archived-legacy-drink",
  checkinCode: "AL-OLD001",
  image: null,
};

const PROVIDER_IGNITE = {
  uuid: "aaaa1111-1111-4111-8111-111111111111",
  name: "Ignite Productions",
  slug: "ignite-productions",
  contactEmail: "ops@igniteproductions.co",
  isIgniteManaged: true,
  includeInCombinedReporting: true,
  inclusionNotes: "Primary field agency",
};

const PROVIDER_FIELDPULSE = {
  uuid: "bbbb2222-2222-4222-8222-222222222222",
  name: "FieldPulse Demos",
  slug: "fieldpulse-demos",
  contactEmail: "team@fieldpulse.example",
  isIgniteManaged: false,
  includeInCombinedReporting: true,
  inclusionNotes: "Midwest regional partner",
};

const WORKSPACE_OVERVIEW = {
  tenantUuid: TENANT_A.uuid,
  tenantName: TENANT_A.name,
  mode: "hybrid",
  planTier: "pilot_pro",
  defaultContributionPerUnit: "2.40",
  viewerRole: "brand_admin",
  viewerProviderUuid: null,
  viewerProviderName: null,
  isBrandAdmin: true,
  canViewConsolidated: true,
  canEditBrandOps: true,
  canApproveRecaps: true,
  canEditFinance: true,
  canApproveSpend: true,
  canManagePos: true,
  providers: [PROVIDER_IGNITE, PROVIDER_FIELDPULSE],
  members: [
    {
      uuid: "mem-1",
      userId: 10,
      email: "kyle@igniteproductions.co",
      fullName: "Kyle Admin",
      workspaceRole: "brand_admin",
      providerUuid: null,
      providerName: null,
      canApproveRecaps: true,
      canApproveFinance: true,
      canApproveSpend: true,
      status: "active",
      createdAt: "2026-10-01T14:00:00Z",
    },
    {
      uuid: "mem-2",
      userId: 11,
      email: "finance@sparkdemo.example",
      fullName: "Jordan Lee",
      workspaceRole: "finance_reviewer",
      providerUuid: null,
      providerName: null,
      canApproveRecaps: false,
      canApproveFinance: true,
      canApproveSpend: true,
      status: "active",
      createdAt: "2026-10-05T16:30:00Z",
    },
  ],
  invitations: [],
  assignments: [
    {
      uuid: "asg-1",
      providerUuid: PROVIDER_FIELDPULSE.uuid,
      providerName: PROVIDER_FIELDPULSE.name,
      scopeType: "program",
      programName: "Retail Sampling Q4",
      visitUuid: null,
      storeLabel: "Whole Foods #104 — Austin, TX",
      status: "assigned",
      submissionCode: "FP-7741",
      dueDate: "2026-11-30",
      notes: "Focus on chilled endcap placement.",
      responseNote: "Confirmed rep coverage",
    },
  ],
  auditLogs: [
    {
      uuid: "aud-1",
      actorEmail: "kyle@igniteproductions.co",
      category: "permissions",
      action: "provider_registered",
      summary: "Registered FieldPulse Demos for Midwest retail coverage",
      createdAt: "2026-11-18T15:20:00Z",
    },
  ],
  programs: [
    { id: 1, name: "Retail Sampling Q4", subtitle: "In-store demos" },
    { id: 2, name: "Event Activations", subtitle: "Festivals & roadshows" },
  ],
  stores: [
    { id: 101, name: "Whole Foods #104", subtitle: "Austin, TX" },
    { id: 102, name: "Sprouts #218", subtitle: "Denver, CO" },
  ],
  products: [
    { id: 501, name: "Citrus Spark 12oz", subtitle: "SKU-CIT-12" },
    { id: 502, name: "Berry Reserve 12oz", subtitle: "SKU-BER-12" },
  ],
};

function extractOperationName(queryText: string, explicitOp?: string): string {
  if (explicitOp) return explicitOp;
  const match = /\b(?:query|mutation)\s+([A-Za-z0-9_]+)/.exec(queryText);
  return match ? match[1] : "";
}

function buildGraphqlData(
  queryText: string,
  operationName: string,
  persona: MockPersona,
  state: { activeTenantUuid: string },
): Record<string, unknown> {
  const op = operationName;

  if (op === "MeQuery" || /\bme\s*\{/.test(queryText)) {
    const isClient = persona === "client-single";
    return {
      me: {
        __typename: "UserType",
        id: isClient ? "VXNlcjoxMDAy" : "VXNlcjoxMDAx",
        uuid: isClient
          ? "99999999-9999-4999-8999-999999999992"
          : "99999999-9999-4999-8999-999999999991",
        email: isClient
          ? "brand@sparkdemo.example"
          : "kyle@igniteproductions.co",
        firstName: isClient ? "Maya" : "Kyle",
        lastName: isClient ? "Brand" : "Ops",
        username: isClient ? "maya-brand" : "kyle-ops",
        image: null,
        role: {
          __typename: "RoleType",
          id: isClient ? "Um9sZToy" : "Um9sZTox",
          uuid: isClient
            ? "88888888-8888-4888-8888-888888888882"
            : "88888888-8888-4888-8888-888888888881",
          name: isClient ? "client" : "admin",
        },
      },
    };
  }

  if (op === "legalStatusQuery" || queryText.includes("myLegalStatus")) {
    return {
      myLegalStatus: {
        required: false,
        needsAcceptance: false,
        currentVersion: "2026-10",
        isUpdate: false,
        changeSummary: null,
        documents: [],
      },
    };
  }

  if (op === "TenantQuery" || /\btenants\s*\(/.test(queryText)) {
    const nodes =
      persona === "client-single"
        ? [TENANT_A]
        : [TENANT_A, TENANT_B, TENANT_ARCHIVED];
    return {
      tenants: {
        totalCount: nodes.length,
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: "c0",
          endCursor: `c${nodes.length - 1}`,
        },
        edges: nodes.map((node, idx) => ({
          cursor: `c${idx}`,
          node,
        })),
      },
    };
  }

  if (
    op === "PilotQueriesWorkspaceContextsQuery" ||
    queryText.includes("myWorkspaceContexts")
  ) {
    if (persona === "client-single") {
      return {
        myWorkspaceContexts: [
          {
            membershipUuid: "mem-single-1",
            tenantUuid: TENANT_A.uuid,
            tenantName: TENANT_A.name,
            tenantSlug: TENANT_A.tenantSlug,
            workspaceRole: "brand_admin",
            providerUuid: null,
            providerName: null,
            canApproveRecaps: true,
            canApproveFinance: true,
            canApproveSpend: true,
            displayLabel: `${TENANT_A.name} · Brand Admin`,
            isCurrent: true,
          },
        ],
      };
    }

    return {
      myWorkspaceContexts: [
        {
          membershipUuid: "mem-multi-a",
          tenantUuid: TENANT_A.uuid,
          tenantName: TENANT_A.name,
          tenantSlug: TENANT_A.tenantSlug,
          workspaceRole: "brand_admin",
          providerUuid: null,
          providerName: null,
          canApproveRecaps: true,
          canApproveFinance: true,
          canApproveSpend: true,
          displayLabel: `${TENANT_A.name} · Brand Admin`,
          isCurrent: state.activeTenantUuid === TENANT_A.uuid,
        },
        {
          membershipUuid: "mem-multi-b",
          tenantUuid: TENANT_B.uuid,
          tenantName: TENANT_B.name,
          tenantSlug: TENANT_B.tenantSlug,
          workspaceRole: "brand_admin",
          providerUuid: null,
          providerName: null,
          canApproveRecaps: true,
          canApproveFinance: true,
          canApproveSpend: true,
          displayLabel: `${TENANT_B.name} · Brand Admin`,
          isCurrent: state.activeTenantUuid === TENANT_B.uuid,
        },
        {
          membershipUuid: "mem-multi-archived",
          tenantUuid: TENANT_ARCHIVED.uuid,
          tenantName: TENANT_ARCHIVED.name,
          tenantSlug: TENANT_ARCHIVED.tenantSlug,
          workspaceRole: "brand_viewer",
          providerUuid: null,
          providerName: null,
          canApproveRecaps: false,
          canApproveFinance: false,
          canApproveSpend: false,
          displayLabel: `${TENANT_ARCHIVED.name} · Read-Only Viewer`,
          isCurrent: false,
        },
      ],
    };
  }

  if (
    op === "PilotMutationsSwitchContextMutation" ||
    queryText.includes("switchWorkspaceContext")
  ) {
    return {
      switchWorkspaceContext: {
        ok: true,
        error: null,
        targetUuid: state.activeTenantUuid,
      },
    };
  }

  if (
    op === "PilotMutationsCreateStoreActionMutation" ||
    queryText.includes("createStoreInsightAction")
  ) {
    return {
      createStoreInsightAction: {
        ok: true,
        error: null,
        targetUuid: "act-created-1",
      },
    };
  }

  if (op === "SidebarCountsQuery" || queryText.includes("sidebarRequestCounts")) {
    return {
      sidebarRequestCounts: {
        tracker: 14,
        approvals: 3,
        approvalsSlaBreach: 1,
        upcoming: 7,
        done30d: 26,
        recapsDue: 2,
      },
      sidebarAlertCandidates: [],
      pendingWalkupCount: 1,
      recapsNeedsReview: { total: 4 },
    };
  }

  if (queryText.includes("myUnreadNotificationCount")) {
    return { myUnreadNotificationCount: 2 };
  }

  if (queryText.includes("pendingShiftExtensions")) {
    return {
      pendingShiftExtensions: [],
      myNotifications: [],
    };
  }

  if (queryText.includes("chatUnreadCount")) {
    return { chatUnreadCount: 0 };
  }

  if (queryText.includes("brandGroupAccess") || queryText.includes("brandCompareGate")) {
    return { brandGroupAccess: null, canCompareBrands: false };
  }

  if (queryText.includes("liveShiftBoard")) {
    return { liveShiftBoard: [] };
  }

  if (queryText.includes("sheetShifts")) {
    return { sheetShifts: [] };
  }

  if (queryText.includes("clockSessions")) {
    return { clockSessions: [] };
  }

  if (
    op === "TenantStoreInsightsQuery" ||
    queryText.includes("tenantStoreInsights")
  ) {
    return {
      tenantStoreInsights: {
        recommendations: [
          {
            id: "rec-1",
            kind: "store",
            // Detector codes must match GO_BACK_CODES / FIX_CODES in
            // src/lib/storeInsights.ts or the card renders empty groups.
            code: "top_store",
            subject: "Whole Foods #104 — Austin, TX",
            text: "Strong 44% sample-to-purchase conversion over 4 weekend demos. Schedule a repeat demo before holiday display reset.",
            periodStart: "2026-08-24",
            periodEnd: "2026-11-22",
            isDraft: false,
            scopeKey: "store:wfm-104",
            visitCount: 4,
            comparisonPeriod: "vs 28% chain avg",
            supportedCost: "920.00",
            adjustedPosUnits: 148,
            eligibleStores: [
              {
                storeKey: "wfm-104",
                storeLabel: "Whole Foods #104 — Austin, TX",
              },
            ],
            currentActionUuid: null,
            currentActionType: null,
            currentActionStatus: null,
            currentActionOwner: null,
            currentActionProvider: null,
          },
          {
            id: "rec-2",
            kind: "store",
            code: "repeat_no_product",
            subject: "Sprouts #218 — Denver, CO",
            text: "Citrus Spark 12oz sold out mid-shift on 2 consecutive visits. Confirm backroom restock before booking another crew.",
            periodStart: "2026-08-24",
            periodEnd: "2026-11-22",
            isDraft: false,
            scopeKey: "store:spr-218",
            visitCount: 3,
            comparisonPeriod: "2 OOS flags",
            supportedCost: "675.00",
            adjustedPosUnits: 64,
            eligibleStores: [
              {
                storeKey: "spr-218",
                storeLabel: "Sprouts #218 — Denver, CO",
              },
            ],
            // Leave action unset so Restock check / Hold stay available
            // alongside the go-back Rebook row above.
            currentActionUuid: null,
            currentActionType: null,
            currentActionStatus: null,
            currentActionOwner: null,
            currentActionProvider: null,
          },
        ],
        alerts: [
          {
            id: "alert-1",
            kind: "store",
            code: "oos_alert",
            subject: "Central Market #09 — Dallas, TX",
            text: "Zero facings of Berry Reserve 12oz reported on Saturday afternoon check-in.",
            periodStart: "2026-11-15",
            periodEnd: "2026-11-22",
            isDraft: false,
            scopeKey: "store:cm-09",
            visitCount: 2,
            comparisonPeriod: "Last 7d",
          },
        ],
      },
    };
  }

  if (queryText.includes("tenantWeeklySummary")) {
    return {
      tenantWeeklySummary: {
        weekStart: "2026-11-15",
        weekEnd: "2026-11-21",
        isDraft: false,
        text: "18 retail demos ran across Austin and Denver last week with 39% conversion and strong repeat velocity on Citrus Spark 12oz.",
      },
    };
  }

  if (queryText.includes("tenantConversionKpis")) {
    return {
      tenantConversionKpis: {
        sold: 312,
        engagements: 810,
        pct: 38.5,
        previousPct: 34.1,
        previousLabel: "prior 30d",
        sparseNote: null,
        dryRecaps: 0,
        retailSold: 312,
        retailEngagements: 810,
        onPremSold: 0,
        onPremEngagements: 0,
      },
    };
  }

  if (queryText.includes("tenantFieldCadence")) {
    return {
      tenantFieldCadence: {
        scheduledNext7: 9,
        approvedRecapsLast7: 14,
      },
    };
  }

  if (queryText.includes("tenantKpiComparison")) {
    return {
      tenantKpiComparison: {
        currentLabel: "This month",
        previousLabel: "Last month",
        sparseNote: null,
        current: {
          consumersReached: 810,
          samplesDistributed: 940,
          totalEngagements: 810,
          firstTimeConsumers: 520,
          program: { firstTimeBase: 810, firstTimeConsumers: 520 },
        },
        previous: {
          consumersReached: 690,
          samplesDistributed: 790,
          totalEngagements: 690,
          firstTimeConsumers: 410,
          program: { firstTimeBase: 690, firstTimeConsumers: 410 },
        },
      },
    };
  }

  if (queryText.includes("tenantActivationBreakdown")) {
    return {
      tenantActivationBreakdown: {
        buckets: [
          { key: "retail", label: "Retail", count: 18 },
          { key: "onprem", label: "On-Premise", count: 4 },
          { key: "event", label: "Event", count: 3 },
        ],
      },
    };
  }

  if (queryText.includes("tenantSkuPulse")) {
    return {
      tenantSkuPulse: {
        totalSamples: 940,
        items: [
          { product: "Citrus Spark 12oz", samples: 560 },
          { product: "Berry Reserve 12oz", samples: 380 },
        ],
      },
    };
  }

  if (op === "PilotQueriesWorkspaceOverviewQuery") {
    return { workspaceOverview: WORKSPACE_OVERVIEW };
  }

  if (op === "PilotQueriesImportsPageQuery") {
    return {
      workspaceOverview: {
        tenantName: WORKSPACE_OVERVIEW.tenantName,
        viewerRole: WORKSPACE_OVERVIEW.viewerRole,
        viewerProviderUuid: null,
        viewerProviderName: null,
        isBrandAdmin: true,
        canViewConsolidated: true,
        canEditBrandOps: true,
        providers: WORKSPACE_OVERVIEW.providers.map((p) => ({
          uuid: p.uuid,
          name: p.name,
          includeInCombinedReporting: p.includeInCombinedReporting,
        })),
        stores: WORKSPACE_OVERVIEW.stores,
        products: WORKSPACE_OVERVIEW.products,
      },
      providerImportWorkspace: {
        presets: [
          {
            key: "agency_fieldpulse",
            label: "FieldPulse Standard CSV",
            columnMapJson: "{}",
          },
          {
            key: "generic_demo",
            label: "Generic Retail Demo CSV",
            columnMapJson: "{}",
          },
        ],
        savedMappings: [
          {
            uuid: "map-1",
            providerUuid: PROVIDER_FIELDPULSE.uuid,
            providerName: PROVIDER_FIELDPULSE.name,
            name: "Q4 Standard Export",
            presetKey: "agency_fieldpulse",
            columnMapJson: "{}",
            isDefault: true,
          },
        ],
        recentJobs: [
          {
            uuid: "job-1",
            providerUuid: PROVIDER_FIELDPULSE.uuid,
            providerName: PROVIDER_FIELDPULSE.name,
            filename: "fieldpulse_nov_week2.csv",
            status: "completed",
            isHistorical: false,
            totalRows: 24,
            createdCount: 19,
            updatedCount: 3,
            unchangedCount: 1,
            reviewCount: 1,
            errorCount: 0,
            createdAt: "2026-11-19T18:10:00Z",
          },
        ],
        reviewQueue: [
          {
            rowUuid: "rev-row-1",
            rowNumber: 14,
            status: "needs_review",
            errorCode: "store_alias_uncertain",
            message: "Unmatched store 'WFM Lamar #104' — confirm store mapping.",
            rawRowJson: "{}",
            normalizedRowJson: "{}",
          },
        ],
      },
    };
  }

  if (op === "PilotQueriesDemoCostsPageQuery") {
    return {
      workspaceOverview: {
        tenantName: WORKSPACE_OVERVIEW.tenantName,
        isBrandAdmin: true,
        canViewConsolidated: true,
        canEditFinance: true,
        canApproveSpend: true,
        providers: WORKSPACE_OVERVIEW.providers.map((p) => ({
          uuid: p.uuid,
          name: p.name,
        })),
      },
      brandCostDashboard: {
        groupBy: "store",
        agreements: [
          {
            uuid: "agr-1",
            providerUuid: PROVIDER_IGNITE.uuid,
            providerName: PROVIDER_IGNITE.name,
            name: "Standard Retail Rate Card",
            contractedDemoFee: "225.00",
            includedHours: "4.00",
            extraHourRate: "45.00",
            mileageRate: "0.67",
            adminFeePercent: "10.00",
            adminFeeBases: ["product"],
            taxPercent: "0.00",
          },
        ],
        rollups: [
          {
            key: "wfm-104",
            label: "Whole Foods #104 — Austin, TX",
            visitCount: 4,
            completeVisitCount: 3,
            incompleteVisitCount: 1,
            totalCost: "1180.00",
            knownTotalCost: "1180.00",
            supportedCost: "920.00",
            invoicedCost: "920.00",
            paidCost: "690.00",
            estimatedCost: "260.00",
            hasIncompleteCosts: true,
            costPerSample: "2.15",
            costPerObservedUnit: "7.97",
          },
        ],
      },
      canonicalVisits: [
        {
          uuid: "vis-1",
          storeKey: "wfm-104",
          storeLabel: "Whole Foods #104 — Austin, TX",
          chainLabel: "Whole Foods Market",
          market: "Austin, TX",
          visitDate: "2026-11-16",
          shiftKey: "afternoon",
          status: "completed",
          primaryProviderName: "Ignite Productions",
          excludeFromAggregates: false,
          samplesDistributed: 140,
          consumersSampled: 118,
          repObservedUnits: 44,
          totalCost: "285.50",
          supportedCost: "285.50",
          isCostIncomplete: false,
          settlementStatus: "paid",
          evidenceStatus: "supported",
          costPerSample: "2.04",
          costPerObservedUnit: "6.49",
          efficiencyWithheldReason: null,
          submissions: [],
          costLines: [
            {
              uuid: "cl-1",
              category: "demo_fee",
              sourceType: "rate_card",
              description: "4hr retail demo",
              amount: "225.00",
              isConfirmedZero: false,
              settlementStatus: "paid",
              evidenceStatus: "supported",
              allocationPercentage: "100.00",
              providerName: "Ignite Productions",
              evidenceCount: 1,
              hasUnitemizedProof: false,
            },
            {
              uuid: "cl-2",
              category: "product",
              sourceType: "receipt",
              description: "Sample stock purchase",
              amount: "60.50",
              isConfirmedZero: false,
              settlementStatus: "invoiced",
              evidenceStatus: "supported",
              allocationPercentage: "100.00",
              providerName: "Ignite Productions",
              evidenceCount: 1,
              hasUnitemizedProof: false,
            },
          ],
        },
        {
          uuid: "vis-2",
          storeKey: "spr-218",
          storeLabel: "Sprouts #218 — Denver, CO",
          chainLabel: "Sprouts Farmers Market",
          market: "Denver, CO",
          visitDate: "2026-11-18",
          shiftKey: "morning",
          status: "completed",
          primaryProviderName: "FieldPulse Demos",
          excludeFromAggregates: false,
          samplesDistributed: 92,
          consumersSampled: 80,
          repObservedUnits: 21,
          totalCost: null,
          supportedCost: "0.00",
          isCostIncomplete: true,
          settlementStatus: "estimated",
          evidenceStatus: "missing",
          costPerSample: null,
          costPerObservedUnit: null,
          efficiencyWithheldReason: "Missing itemized receipt proof for product spend.",
          submissions: [],
          costLines: [],
        },
      ],
    };
  }

  if (op === "PilotQueriesFinanceQueuePageQuery") {
    return {
      workspaceOverview: {
        tenantName: WORKSPACE_OVERVIEW.tenantName,
        isBrandAdmin: true,
        canEditFinance: true,
        members: WORKSPACE_OVERVIEW.members.map((m) => ({
          uuid: m.uuid,
          userId: m.userId,
          email: m.email,
          fullName: m.fullName,
          workspaceRole: m.workspaceRole,
          status: m.status,
        })),
        providers: WORKSPACE_OVERVIEW.providers.map((p) => ({
          uuid: p.uuid,
          name: p.name,
        })),
      },
      financeExceptionQueue: {
        exceptions: [
          {
            uuid: "exc-1",
            exceptionType: "missing_proof",
            severity: "high",
            status: "open",
            affectedAmount: "64.20",
            sourceLabel: "Product receipt",
            explanation:
              "Product purchase line lacks an itemized store receipt photo.",
            visitUuid: "vis-2",
            storeLabel: "Sprouts #218 — Denver, CO",
            visitDate: "2026-11-18",
            costLineUuid: "cl-9",
            providerName: "FieldPulse Demos",
            ownerUserId: 11,
            ownerEmail: "finance@sparkdemo.example",
            clarificationNote: null,
            resolutionReason: null,
            createdAt: "2026-11-19T12:00:00Z",
            audits: [
              {
                uuid: "fa-1",
                actorEmail: "system",
                action: "opened",
                note: "Auto-flagged during recap ingest",
                createdAt: "2026-11-19T12:00:00Z",
              },
            ],
          },
          {
            uuid: "exc-2",
            exceptionType: "unitemized_proof",
            severity: "medium",
            status: "resolved",
            affectedAmount: "42.00",
            sourceLabel: "Supplies",
            explanation: "Ice and cups slip verified against store total.",
            visitUuid: "vis-1",
            storeLabel: "Whole Foods #104 — Austin, TX",
            visitDate: "2026-11-16",
            costLineUuid: "cl-8",
            providerName: "Ignite Productions",
            ownerUserId: 10,
            ownerEmail: "kyle@igniteproductions.co",
            clarificationNote: null,
            resolutionReason: "Verified itemized receipt attached.",
            createdAt: "2026-11-17T09:15:00Z",
            audits: [],
          },
        ],
        operationalNotices: [
          {
            id: "opn-1",
            kind: "short_clock_in",
            status: "advisory",
            detail: "Clocked duration 3h 40m vs 4h booked at Sprouts #218.",
            eventId: "ev-22",
            createdAt: "2026-11-18T19:00:00Z",
          },
        ],
      },
      canonicalVisits: [
        {
          uuid: "vis-1",
          storeLabel: "Whole Foods #104 — Austin, TX",
          visitDate: "2026-11-16",
        },
        {
          uuid: "vis-2",
          storeLabel: "Sprouts #218 — Denver, CO",
          visitDate: "2026-11-18",
        },
      ],
    };
  }

  if (op === "PilotQueriesRetailerPosPageQuery") {
    return {
      workspaceOverview: {
        tenantName: WORKSPACE_OVERVIEW.tenantName,
        defaultContributionPerUnit: "2.40",
        canManagePos: true,
        stores: WORKSPACE_OVERVIEW.stores,
        products: WORKSPACE_OVERVIEW.products,
      },
      posAutomationWorkspace: {
        presets: [
          {
            key: "unfi_clearview",
            label: "UNFI ClearView",
            columnMapJson: "{}",
            defaultBanner: "Whole Foods Market",
          },
          {
            key: "kehe_connect",
            label: "KeHE Connect",
            columnMapJson: "{}",
            defaultBanner: "Sprouts Farmers Market",
          },
        ],
        feeds: [],
        recentDrops: [],
      },
      retailerPosDashboard: {
        available: true,
        unavailableMessage: null,
        retailerBanners: ["Whole Foods Market", "Sprouts Farmers Market"],
        matchedStoreSkuWeeks: 18,
        eligibleStoreSkuWeeks: 20,
        coverageRatio: "0.90",
        unmatchedRowCount: 1,
        missingRows: [],
        repObservedUnits: 196,
        registerUnits: 242,
        crewPurchasedUnits: 18,
        adjustedRegisterUnits: 224,
        observedVsBaselineDiff: "+58",
        incrementalLiftUnits: "58",
        incrementalContribution: "139.20",
        eligibleBrandCost: "920.00",
        roi: "1.42",
        liftWithheldReason: null,
        roiWithheldReason: null,
        imports: [
          {
            uuid: "pos-imp-1",
            retailerBanner: "Whole Foods Market",
            periodStart: "2026-11-09",
            periodEnd: "2026-11-15",
            version: 1,
            isActiveVersion: true,
            feedCompleteness: "complete",
            filename: "wfm_pos_w46.csv",
            totalRows: 20,
            matchedRows: 19,
            unmatchedRows: 1,
            createdAt: "2026-11-17T10:00:00Z",
          },
        ],
        unmatchedRows: [
          {
            uuid: "pos-unm-1",
            rowNumber: 7,
            rawRetailer: "Whole Foods",
            rawStoreId: "WFM-991",
            rawStoreName: "WFM Domain North",
            rawSku: "CITRUS-12PK",
            rawWeekStart: "2026-11-09",
            registerUnits: 32,
            matchStatus: "unmatched",
            matchNote: "Store ID not yet linked to a canonical store.",
          },
        ],
        storeWeeks: [
          {
            storeKey: "wfm-104",
            storeLabel: "Whole Foods #104 — Austin, TX",
            weekStart: "2026-11-09",
            weekEnd: "2026-11-15",
            demoCount: 2,
            sharedStoreWeek: true,
            repObservedUnits: 84,
            registerUnits: 112,
            crewPurchasedUnits: 10,
            adjustedRegisterUnits: 102,
            observedVsBaselineDiff: "+34",
            incrementalLiftUnits: "34",
            eligibleBrandCost: "480.00",
            incrementalContribution: "81.60",
            roi: "1.65",
            roiWithheldReason: null,
            skuCellsJson: "[]",
          },
        ],
      },
      canonicalVisits: [
        {
          uuid: "vis-1",
          storeKey: "wfm-104",
          storeLabel: "Whole Foods #104 — Austin, TX",
          visitDate: "2026-11-16",
        },
      ],
    };
  }

  if (op === "PilotQueriesBuyerReportPageQuery") {
    return {
      workspaceOverview: {
        tenantName: WORKSPACE_OVERVIEW.tenantName,
        isBrandAdmin: true,
        canEditBrandOps: true,
        canApproveSpend: true,
        canManagePos: true,
        buyerWeeklyDigestEnabled: false,
        buyerDigestRecipientEmails: "",
        viewerProviderUuid: PROVIDER_FIELDPULSE.uuid,
        providers: WORKSPACE_OVERVIEW.providers.map((p) => ({
          uuid: p.uuid,
          name: p.name,
        })),
        members: WORKSPACE_OVERVIEW.members.map((m) => ({
          uuid: m.uuid,
          userId: m.userId,
          email: m.email,
          fullName: m.fullName,
          workspaceRole: m.workspaceRole,
          status: m.status,
        })),
      },
      weeklyBuyerStoreReport: {
        periodStart: "2026-10-24",
        periodEnd: "2026-11-22",
        posAvailable: true,
        totalVisits: 12,
        totalSupportedCost: "2,840.00",
        rows: [
          {
            storeKey: "wfm-104",
            storeLabel: "Whole Foods #104 — Austin, TX",
            retailerBanner: "Whole Foods Market",
            market: "Austin, TX",
            providers: ["Ignite Productions"],
            visitCount: 4,
            supportedBrandCost: "920.00",
            totalBrandCost: "1180.00",
            hasIncompleteCost: false,
            samplesDistributed: 420,
            repObservedUnits: 148,
            matchedRegisterUnits: 162,
            adjustedRegisterUnits: 152,
            posCoverageLabel: "100% matched",
            recommendationId: "rec-1",
            recommendationCode: "go_back_high_conversion",
            recommendationSummary: "Repeat weekend demo before holiday reset.",
            currentActionUuid: "act-1",
            currentActionType: "rebook",
            currentActionStatus: "scheduled",
            currentActionOwner: "kyle@igniteproductions.co",
            currentActionProvider: "Ignite Productions",
          },
        ],
      },
      storeRecommendationActions: [
        {
          uuid: "act-1",
          findingId: "rec-1",
          findingCode: "go_back_high_conversion",
          findingScopeKey: "store:wfm-104",
          storeKey: "wfm-104",
          storeLabel: "Whole Foods #104 — Austin, TX",
          actionType: "rebook",
          status: "scheduled",
          providerUuid: PROVIDER_FIELDPULSE.uuid,
          providerName: PROVIDER_FIELDPULSE.name,
          previousProviderName: null,
          ownerEmail: "kyle@igniteproductions.co",
          targetDate: "2026-12-05",
          dueDate: null,
          holdReason: null,
          nextReviewDate: null,
          providerResponseStatus: "pending",
          providerResponseNote: null,
          restockVerificationMethod: null,
          restockVerificationNote: null,
          submissionCode: "FP-REBOOK-1",
          linkedRequestUuid: null,
          outcomeVisitUuid: null,
          decisionSnapshotJson: "{}",
          outcomeSummaryJson: "{}",
          historyLogJson: "[]",
          createdAt: "2026-11-20T15:00:00Z",
        },
        {
          uuid: "act-2",
          findingId: "rec-2",
          findingCode: "fix_low_inventory",
          findingScopeKey: "store:spr-218",
          storeKey: "spr-218",
          storeLabel: "Sprouts #218 — Denver, CO",
          actionType: "restock",
          status: "open",
          providerUuid: PROVIDER_IGNITE.uuid,
          providerName: PROVIDER_IGNITE.name,
          previousProviderName: null,
          ownerEmail: "kyle@igniteproductions.co",
          targetDate: null,
          dueDate: "2026-11-28",
          holdReason: null,
          nextReviewDate: null,
          providerResponseStatus: "accepted",
          providerResponseNote: null,
          restockVerificationMethod: null,
          restockVerificationNote: null,
          submissionCode: null,
          linkedRequestUuid: null,
          outcomeVisitUuid: null,
          decisionSnapshotJson: "{}",
          outcomeSummaryJson: "{}",
          historyLogJson: "[]",
          createdAt: "2026-11-20T16:30:00Z",
        },
      ],
    };
  }

  // SPA-35 Buyer Pitch Decks — share card on /buyer-report loads this query
  // alongside the main buyer report. Missing mock → undefined → .length crash.
  if (
    op === "PitchDeckQueriesBuyerPitchDecksQuery" ||
    queryText.includes("buyerPitchDecks")
  ) {
    return {
      buyerPitchDecks: [
        {
          uuid: "deck-demo-1",
          token: "pitch-demo-token-aaaa",
          title: "Sprouts Line Review",
          subtitle: "",
          buyerName: "Category Buyer",
          periodStart: "2026-10-24",
          periodEnd: "2026-11-22",
          retailerFilter: "Sprouts",
          marketFilter: "",
          includeCosts: false,
          hasPasscode: true,
          expiresAt: "2026-12-22T00:00:00Z",
          revokedAt: null,
          photoCount: 2,
          viewCount: 0,
          createdAt: "2026-11-20T18:00:00Z",
          createdByEmail: "kyle@igniteproductions.co",
        },
      ],
    };
  }
  if (
    op === "PitchDeckQueriesPhotoWallQuery" ||
    queryText.includes("photoWall(")
  ) {
    return {
      photoWall: {
        total: 0,
        pinnedCount: 0,
        retailers: [],
        markets: [],
        skus: [],
        categories: [],
        photos: [],
      },
    };
  }

  // Safe empty stubs for dashboard / chart / attention queries so Relay
  // consumers render (or quietly no-op) without throwing before StoreInsights.
  if (queryText.includes("eventDashboard")) {
    return {
      eventDashboard: {
        kpis: null,
        recentEvents: [],
        timeline: [],
      },
    };
  }
  if (queryText.includes("tenantActivationBreakdown")) {
    return {
      tenantActivationBreakdown: {
        buckets: [
          { key: "retail", label: "Retail", count: 4 },
          { key: "onprem", label: "On-Premise", count: 1 },
          { key: "event", label: "Event", count: 2 },
        ],
      },
    };
  }
  if (queryText.includes("tenantConversionKpis")) {
    return { tenantConversionKpis: null };
  }
  if (queryText.includes("tenantSkuPulse")) {
    return { tenantSkuPulse: null };
  }
  if (queryText.includes("executiveSummary") || op.includes("ExecutiveSummary")) {
    return { executiveSummary: null };
  }
  if (queryText.includes("tenantGoals") || op.includes("TenantGoals")) {
    return { tenantGoals: [] };
  }
  if (
    queryText.includes("weeklySummary") ||
    queryText.includes("tenantWeeklySummary") ||
    op.includes("WeeklySummary")
  ) {
    return { tenantWeeklySummary: null, weeklySummary: null };
  }
  if (queryText.includes("setupChecklist")) {
    return { setupChecklist: null };
  }
  if (queryText.includes("clockSummary") || queryText.includes("todayClock")) {
    return { clockSummary: null, todayClockSessions: [] };
  }
  if (queryText.includes("staffingGlance") || queryText.includes("staffingBoard")) {
    return { staffingGlance: null, staffingBoard: [] };
  }
  // SPA-37 Budget Pacing / Today's Attention — must precede the generic
  // "Attention" catch-all below (that matcher also hits these op names and
  // previously returned `{}`-shaped data → strip crash on brand switch).
  if (
    queryText.includes("todayAttentionQueue") ||
    op.includes("TodayAttentionQueue")
  ) {
    return {
      todayAttentionQueue: {
        totalCount: 0,
        buckets: [],
      },
    };
  }
  if (
    queryText.includes("demoBudgetPacingAndLeaderboard") ||
    op.includes("RoiPacingQueriesPage")
  ) {
    return {
      demoBudgetPacingAndLeaderboard: {
        month: "2026-11",
        monthEnd: "2026-11-30",
        targetAmount: 0,
        spentAmount: 0,
        committedAmount: 0,
        projectedAmount: 0,
        elapsedDays: 1,
        daysInMonth: 30,
        elapsedPct: 0,
        expectedSpendToDate: 0,
        paceStatus: "on_track",
        paceNote: null,
        visitCount: 0,
        incompleteCostVisits: 0,
        canEditBudget: false,
        groupBy: "retailer",
        sortBy: "units_per_dollar",
        targets: [],
        leaderboard: [],
      },
    };
  }
  if (
    queryText.includes("upsertDemoBudgetTarget") ||
    op.includes("RoiPacingMutations")
  ) {
    return {
      upsertDemoBudgetTarget: {
        ok: true,
        reason: null,
        target: null,
      },
    };
  }
  if (queryText.includes("attention") || queryText.includes("Attention")) {
    return {
      homeAttention: null,
      attentionItems: [],
      requests: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } },
    };
  }

  // Fallback for non-critical dashboard/background queries (charts, prefetch, etc.)
  return {};
}

/**
 * Seed localStorage auth + appearance state before the app boots so every
 * route renders immediately in the target appearance and persona.
 */
export async function seedSparkSession(
  page: Page,
  opts: {
    appearance: "light" | "dark";
    authenticated: boolean;
    persona?: MockPersona;
  },
): Promise<void> {
  const persona = opts.persona ?? "admin-multi";
  await page.addInitScript(
    ({ appearance, authenticated, tenant, isClient }) => {
      try {
        localStorage.clear();
        localStorage.setItem("@spark.appearance", appearance);
        localStorage.setItem("@theme", "spark-v2");
        if (authenticated) {
          localStorage.setItem("@token", "playwright-mock-jwt-token");
          localStorage.setItem("@refreshToken", "playwright-mock-refresh-token");
          localStorage.setItem("@tenantUuid", tenant.uuid);
          localStorage.setItem("@tenantId", tenant.id);
          localStorage.setItem("@tenantSlug", tenant.tenantSlug);
          localStorage.setItem("@tenantRequestUrlName", tenant.requestUrlName);
          localStorage.setItem("@tenantCheckinCode", tenant.checkinCode);
          localStorage.setItem(
            "@membershipUuid",
            isClient ? "mem-single-1" : "mem-multi-a",
          );
          localStorage.setItem("@workspaceRole", "brand_admin");
        }
      } catch {
        /* ignore */
      }
    },
    {
      appearance: opts.appearance,
      authenticated: opts.authenticated,
      tenant: TENANT_A,
      isClient: persona === "client-single",
    },
  );
}

/**
 * Intercept all GraphQL requests (plus block external third-party hosts so
 * CI runs stay offline, fast, and 100% deterministic).
 */
export async function installMockGraphql(
  page: Page,
  options: MockGraphqlOptions = {},
): Promise<void> {
  const persona = options.persona ?? "admin-multi";
  const state = {
    activeTenantUuid: options.activeTenantUuid ?? TENANT_A.uuid,
  };

  const handleGraphql = async (route: Route) => {
    const req = route.request();
    if (req.method() !== "POST") {
      await route.continue();
      return;
    }

    let payload: {
      query?: string;
      operationName?: string;
      variables?: Record<string, unknown>;
    } = {};
    try {
      payload = req.postDataJSON() as typeof payload;
    } catch {
      payload = {};
    }

    const queryText = payload.query ?? "";
    const operationName = extractOperationName(queryText, payload.operationName);

    if (
      operationName === "PilotMutationsSwitchContextMutation" &&
      typeof payload.variables?.tenantUuid === "string"
    ) {
      state.activeTenantUuid = payload.variables.tenantUuid;
    }

    const data = buildGraphqlData(queryText, operationName, persona, state);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data }),
    });
  };

  await page.route("**/graphql", handleGraphql);
  await page.route("**/undefined", handleGraphql);

  // Stub Google GSI script so Login page never stalls waiting on external CDN
  await page.route("https://accounts.google.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "window.google = window.google || { accounts: { id: { initialize(){}, renderButton(){}, prompt(){} } } };",
    });
  });

  // Allowlist first-party fonts + maps tiles; soft-block everything else with
  // an empty 204 so Chromium does not emit net::ERR_FAILED console noise that
  // would fail the crash guard.
  const ALLOWED_EXTERNAL =
    /^(?:https?:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|maps\.googleapis\.com|maps\.gstatic\.com)(?:\/|$))/i;

  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, async (route) => {
    const url = route.request().url();
    if (ALLOWED_EXTERNAL.test(url)) {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 204, body: "" });
  });
}

export { TENANT_A, TENANT_B, TENANT_ARCHIVED };
