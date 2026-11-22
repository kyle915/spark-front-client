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
      planGated
      planUpgradeMessage
      requiredPlan
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
      planGated
      planUpgradeMessage
      requiredPlan
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
    posAutomationWorkspace {
      presets {
        key
        label
        columnMapJson
        defaultBanner
      }
      feeds {
        uuid
        retailerBanner
        presetKey
        sourceKind
        ingestToken
        enabled
        defaultFeedCompleteness
        notes
        lastIngestedAt
        dropUrlPath
        createdAt
      }
      recentDrops {
        uuid
        feedUuid
        retailerBanner
        status
        filename
        sourceFromEmail
        errorMessage
        salesImportUuid
        matchedRows
        unmatchedRows
        receivedAt
        processedAt
      }
    }
    retailerPosDashboard(
      periodStart: $periodStart
      periodEnd: $periodEnd
      contributionPerUnit: $contributionPerUnit
    ) {
      available
      unavailableMessage
      planGated
      planUpgradeMessage
      requiredPlan
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
      canManagePos
      buyerWeeklyDigestEnabled
      buyerDigestRecipientEmails
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
      planGated
      planUpgradeMessage
      requiredPlan
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

export const PilotQueriesStarterCatalogQuery = graphql`
  query PilotQueriesStarterCatalogQuery {
    selfServeStarterCatalog {
      signupEnabled
      starters {
        key
        name
        slug
        description
        templateName
        defaultSkuHint
      }
    }
  }
`;

export const PilotQueriesOnboardingStateQuery = graphql`
  query PilotQueriesOnboardingStateQuery {
    onboardingState {
      tenantUuid
      tenantName
      tenantSlug
      workspaceMode
      planCode
      planDisplayName
      businessTimezone
      stepsCompleted
      totalSteps
      stepWorkspaceCreated
      stepProgramSelected
      stepContributorInvited
      stepMobileLinkOpened
      stepFirstVisitCompleted
      starterTemplateKey
      starterProgramName
      starterRecapTemplateName
      submissionCode
      firstVisitUuid
      firstVisitStoreLabel
      firstVisitStatus
      firstSharedToken
      completedVisitsUsed
      includedVisits
      recentVisits {
        uuid
        storeLabel
        visitDate
        status
        samplesDistributed
        consumersSampled
        repObservedUnits
        completedAt
        submissionCount
      }
      starters {
        key
        name
        slug
        description
        templateName
        defaultSkuHint
      }
    }
  }
`;

export const PilotQueriesPlansAndBillingQuery = graphql`
  query PilotQueriesPlansAndBillingQuery {
    plansAndBillingOverview {
      billingEnabled
      stripeMode
      stripeConfiguredRemotely
      tenantUuid
      tenantName
      workspaceMode
      businessTimezone
      canManageBilling
      isIgniteAdmin
      configuredPlanCode
      effectivePlanCode
      planDisplayName
      subscriptionStatus
      pendingPlanCode
      addonPlanCode
      monthlyPriceUsd
      isManagedSow
      isPilot
      pilotFeeUsd
      pilotStartsAt
      pilotEndsAt
      currentPeriodStart
      currentPeriodEnd
      paidThroughAt
      cancelAtPeriodEnd
      hasPaymentFailure
      paymentFailureMessage
      recurringBillingAccepted
      viewerAndContributorSeatsFree
      billingSeparationNotice
      usage {
        monthKey
        businessTimezone
        completedVisitsUsed
        includedVisits
        effectiveVisitCap
        remainingVisits
        atOrOverCap
        overageUnits
        overageAgreementApproved
        canBookNewVisit
        inProgressFieldworkAlwaysAllowed
        historicalExcludedCount
        inProgressOrPendingCount
        cancelledOrReversedCount
        coBrandedVisitCount
        nextUpgradePlan
        countedVisits {
          visitUuid
          storeLabel
          visitDate
          completionLocalDate
          providerName
          submissionCount
          coBrandSharePct
        }
      }
      availablePlans {
        planCode
        displayName
        tagline
        monthlyPriceUsd
        includedCompletedVisits
        isQuoteOnly
        isSelfServeSelectable
        isCurrent
        maxActivePrograms
        maxOperatingProviders
        maxPosRetailers
        allowsBrandedForms
        allowsApprovalsAndReminders
        allowsExportsAndWeeklyReporting
        allowsStoreRecommendations
        allowsProviderCsvImports
        allowsBrandCostTracking
        allowsFinanceReviewQueue
        allowsRetailerPosMeasurement
        allowsTrackedStoreActions
      }
      openCheckouts {
        stripeSessionId
        targetPlanCode
        quotedMonthlyPriceUsd
        checkoutUrl
        status
        effectiveSummary
      }
    }
    billingReadiness {
      billingMode
      billingEnabled
      clientBillingHidden
      secretKeyConfigured
      publishableKeyConfigured
      webhookSecretConfigured
      corePriceConfigured
      proPriceConfigured
      scalePriceConfigured
      testSimulationActive
      webhookEndpointUrl
      recentWebhookCount
      failedWebhookCount
      lastWebhookAt
      lastWebhookEventType
      lastWebhookStatus
      recentWebhooks {
        stripeEventId
        eventType
        processingStatus
        livemode
        processedAt
        note
      }
    }
  }
`;

export const PilotQueriesPreviewPlanChangeQuery = graphql`
  query PilotQueriesPreviewPlanChangeQuery($targetPlanCode: String!) {
    previewSubscriptionPlanChange(targetPlanCode: $targetPlanCode) {
      currentPlanCode
      targetPlanCode
      targetDisplayName
      isQuoteOnly
      canSelfServeConfirm
      monthlyPriceUsd
      chargeTodayUsd
      includedVisits
      changeKind
      effectiveDateLabel
      paidThroughDate
      disclosure
    }
  }
`;

