import { graphql } from "react-relay";

export const PilotQueriesWorkspaceContextsQuery = graphql`
  query PilotQueriesWorkspaceContextsQuery {
    myWorkspaceContexts {
      membershipUuid
      tenantUuid
      tenantName
      tenantSlug
      workspaceRole
      providerUuid
      providerName
      canApproveRecaps
      canApproveFinance
      canApproveSpend
      displayLabel
      isCurrent
    }
  }
`;

export const PilotQueriesWorkspaceOverviewQuery = graphql`
  query PilotQueriesWorkspaceOverviewQuery {
    workspaceOverview {
      tenantUuid
      tenantName
      mode
      planTier
      defaultContributionPerUnit
      viewerRole
      viewerProviderUuid
      viewerProviderName
      isBrandAdmin
      canViewConsolidated
      canEditBrandOps
      canApproveRecaps
      canEditFinance
      canApproveSpend
      canManagePos
      providers {
        uuid
        name
        slug
        contactEmail
        isIgniteManaged
        includeInCombinedReporting
        inclusionNotes
      }
      members {
        uuid
        userId
        email
        fullName
        workspaceRole
        providerUuid
        providerName
        canApproveRecaps
        canApproveFinance
        canApproveSpend
        status
        createdAt
      }
      invitations {
        uuid
        email
        workspaceRole
        providerName
        status
        token
        expiresAt
      }
      assignments {
        uuid
        providerUuid
        providerName
        scopeType
        programName
        visitUuid
        storeLabel
        status
        submissionCode
        dueDate
        notes
        responseNote
      }
      auditLogs {
        uuid
        actorEmail
        category
        action
        summary
        createdAt
      }
      programs {
        id
        name
        subtitle
      }
      stores {
        id
        name
        subtitle
      }
      products {
        id
        name
        subtitle
      }
    }
  }
`;

export const PilotQueriesImportsPageQuery = graphql`
  query PilotQueriesImportsPageQuery {
    workspaceOverview {
      tenantName
      viewerRole
      viewerProviderUuid
      viewerProviderName
      isBrandAdmin
      canViewConsolidated
      canEditBrandOps
      providers {
        uuid
        name
        includeInCombinedReporting
      }
      stores {
        id
        name
        subtitle
      }
      products {
        id
        name
        subtitle
      }
    }
    providerImportWorkspace {
      presets {
        key
        label
        columnMapJson
      }
      savedMappings {
        uuid
        providerUuid
        providerName
        name
        presetKey
        columnMapJson
        isDefault
      }
      recentJobs {
        uuid
        providerUuid
        providerName
        filename
        status
        isHistorical
        totalRows
        createdCount
        updatedCount
        unchangedCount
        reviewCount
        errorCount
        createdAt
      }
      reviewQueue {
        rowUuid
        rowNumber
        status
        errorCode
        message
        rawRowJson
        normalizedRowJson
      }
    }
  }
`;

export const PilotQueriesDemoCostsPageQuery = graphql`
  query PilotQueriesDemoCostsPageQuery(
    $groupBy: String!
    $periodStart: String
    $periodEnd: String
    $providerUuid: String
  ) {
    workspaceOverview {
      tenantName
      isBrandAdmin
      canViewConsolidated
      canEditFinance
      canApproveSpend
      providers {
        uuid
        name
      }
    }
    brandCostDashboard(
      groupBy: $groupBy
      periodStart: $periodStart
      periodEnd: $periodEnd
      providerUuid: $providerUuid
    ) {
      groupBy
      agreements {
        uuid
        providerUuid
        providerName
        name
        contractedDemoFee
        includedHours
        extraHourRate
        mileageRate
        adminFeePercent
        adminFeeBases
        taxPercent
      }
      rollups {
        key
        label
        visitCount
        completeVisitCount
        incompleteVisitCount
        totalCost
        knownTotalCost
        supportedCost
        invoicedCost
        paidCost
        estimatedCost
        hasIncompleteCosts
        costPerSample
        costPerObservedUnit
      }
    }
    canonicalVisits(
      periodStart: $periodStart
      periodEnd: $periodEnd
      providerUuid: $providerUuid
    ) {
      uuid
      storeKey
      storeLabel
      chainLabel
      market
      visitDate
      shiftKey
      status
      primaryProviderName
      excludeFromAggregates
      samplesDistributed
      consumersSampled
      repObservedUnits
      totalCost
      supportedCost
      isCostIncomplete
      settlementStatus
      evidenceStatus
      costPerSample
      costPerObservedUnit
      efficiencyWithheldReason
      submissions {
        uuid
        providerName
        sourceKind
        providerEventId
        recapStatus
        excludeFromAggregates
        version
        samplesDistributed
        consumersSampled
        repObservedUnits
      }
      costLines {
        uuid
        category
        sourceType
        description
        amount
        isConfirmedZero
        settlementStatus
        evidenceStatus
        allocationPercentage
        providerName
        evidenceCount
        hasUnitemizedProof
      }
    }
  }
`;

export const PilotQueriesFinanceQueuePageQuery = graphql`
  query PilotQueriesFinanceQueuePageQuery(
    $exceptionType: String
    $status: String
    $providerUuid: String
    $periodStart: String
    $periodEnd: String
  ) {
    workspaceOverview {
      tenantName
      isBrandAdmin
      canEditFinance
      members {
        uuid
        userId
        email
        fullName
        workspaceRole
        status
      }
      providers {
        uuid
        name
      }
    }
    financeExceptionQueue(
      exceptionType: $exceptionType
      status: $status
      providerUuid: $providerUuid
      periodStart: $periodStart
      periodEnd: $periodEnd
    ) {
      exceptions {
        uuid
        exceptionType
        severity
        status
        affectedAmount
        sourceLabel
        explanation
        visitUuid
        storeLabel
        visitDate
        costLineUuid
        providerName
        ownerUserId
        ownerEmail
        clarificationNote
        resolutionReason
        createdAt
        audits {
          uuid
          actorEmail
          action
          note
          createdAt
        }
      }
      operationalNotices {
        id
        kind
        status
        detail
        eventId
        createdAt
      }
    }
    canonicalVisits(periodStart: $periodStart, periodEnd: $periodEnd) {
      uuid
      storeLabel
      visitDate
    }
  }
`;

export const PilotQueriesRetailerPosPageQuery = graphql`
  query PilotQueriesRetailerPosPageQuery(
    $periodStart: String
    $periodEnd: String
    $contributionPerUnit: String
  ) {
    workspaceOverview {
      tenantName
      defaultContributionPerUnit
      canManagePos
      stores {
        id
        name
        subtitle
      }
      products {
        id
        name
        subtitle
      }
    }
    retailerPosDashboard(
      periodStart: $periodStart
      periodEnd: $periodEnd
      contributionPerUnit: $contributionPerUnit
    ) {
      available
      unavailableMessage
      retailerBanners
      matchedStoreSkuWeeks
      eligibleStoreSkuWeeks
      coverageRatio
      unmatchedRowCount
      missingRows {
        storeKey
        storeLabel
        productId
        productName
        weekStart
        status
      }
      repObservedUnits
      registerUnits
      crewPurchasedUnits
      adjustedRegisterUnits
      observedVsBaselineDiff
      incrementalLiftUnits
      incrementalContribution
      eligibleBrandCost
      roi
      liftWithheldReason
      roiWithheldReason
      imports {
        uuid
        retailerBanner
        periodStart
        periodEnd
        version
        isActiveVersion
        feedCompleteness
        filename
        totalRows
        matchedRows
        unmatchedRows
        createdAt
      }
      unmatchedRows {
        uuid
        rowNumber
        rawRetailer
        rawStoreId
        rawStoreName
        rawSku
        rawWeekStart
        registerUnits
        matchStatus
        matchNote
      }
      storeWeeks {
        storeKey
        storeLabel
        weekStart
        weekEnd
        demoCount
        sharedStoreWeek
        repObservedUnits
        registerUnits
        crewPurchasedUnits
        adjustedRegisterUnits
        observedVsBaselineDiff
        incrementalLiftUnits
        eligibleBrandCost
        incrementalContribution
        roi
        roiWithheldReason
        skuCellsJson
      }
    }
    canonicalVisits(periodStart: $periodStart, periodEnd: $periodEnd) {
      uuid
      storeKey
      storeLabel
      visitDate
    }
  }
`;

export const PilotQueriesBuyerReportPageQuery = graphql`
  query PilotQueriesBuyerReportPageQuery(
    $periodStart: String
    $periodEnd: String
    $retailerFilter: String
    $marketFilter: String
    $providerUuid: String
  ) {
    workspaceOverview {
      tenantName
      isBrandAdmin
      canEditBrandOps
      canApproveSpend
      viewerProviderUuid
      providers {
        uuid
        name
      }
      members {
        uuid
        userId
        email
        fullName
        workspaceRole
        status
      }
    }
    weeklyBuyerStoreReport(
      periodStart: $periodStart
      periodEnd: $periodEnd
      retailerFilter: $retailerFilter
      marketFilter: $marketFilter
      providerUuid: $providerUuid
    ) {
      periodStart
      periodEnd
      posAvailable
      totalVisits
      totalSupportedCost
      rows {
        storeKey
        storeLabel
        retailerBanner
        market
        providers
        visitCount
        supportedBrandCost
        totalBrandCost
        hasIncompleteCost
        samplesDistributed
        repObservedUnits
        matchedRegisterUnits
        adjustedRegisterUnits
        posCoverageLabel
        recommendationId
        recommendationCode
        recommendationSummary
        currentActionUuid
        currentActionType
        currentActionStatus
        currentActionOwner
        currentActionProvider
      }
    }
    storeRecommendationActions {
      uuid
      findingId
      findingCode
      findingScopeKey
      storeKey
      storeLabel
      actionType
      status
      providerUuid
      providerName
      previousProviderName
      ownerEmail
      targetDate
      dueDate
      holdReason
      nextReviewDate
      providerResponseStatus
      providerResponseNote
      restockVerificationMethod
      restockVerificationNote
      submissionCode
      linkedRequestUuid
      outcomeVisitUuid
      decisionSnapshotJson
      outcomeSummaryJson
      historyLogJson
      createdAt
    }
  }
`;

export const PilotQueriesExportBuyerReportQuery = graphql`
  query PilotQueriesExportBuyerReportQuery(
    $format: String!
    $periodStart: String
    $periodEnd: String
    $retailerFilter: String
    $marketFilter: String
    $providerUuid: String
  ) {
    exportWeeklyBuyerReport(
      format: $format
      periodStart: $periodStart
      periodEnd: $periodEnd
      retailerFilter: $retailerFilter
      marketFilter: $marketFilter
      providerUuid: $providerUuid
    ) {
      filename
      mimeType
      isBase64
      content
    }
  }
`;
