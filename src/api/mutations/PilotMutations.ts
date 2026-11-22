import { graphql } from "react-relay";

export const PilotMutationsSwitchContextMutation = graphql`
  mutation PilotMutationsSwitchContextMutation(
    $membershipUuid: String
    $tenantUuid: String
  ) {
    switchWorkspaceContext(
      membershipUuid: $membershipUuid
      tenantUuid: $tenantUuid
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsRegisterProviderMutation = graphql`
  mutation PilotMutationsRegisterProviderMutation(
    $name: String!
    $contactEmail: String!
    $slug: String!
  ) {
    registerProviderOrganization(
      name: $name
      contactEmail: $contactEmail
      slug: $slug
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsInviteMemberMutation = graphql`
  mutation PilotMutationsInviteMemberMutation(
    $email: String!
    $workspaceRole: String!
    $providerUuid: String
    $canApproveRecaps: Boolean!
    $canApproveFinance: Boolean!
    $canApproveSpend: Boolean!
  ) {
    inviteWorkspaceMember(
      email: $email
      workspaceRole: $workspaceRole
      providerUuid: $providerUuid
      canApproveRecaps: $canApproveRecaps
      canApproveFinance: $canApproveFinance
      canApproveSpend: $canApproveSpend
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsRevokeMembershipMutation = graphql`
  mutation PilotMutationsRevokeMembershipMutation($membershipUuid: String!) {
    revokeWorkspaceMembership(membershipUuid: $membershipUuid) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsRevokeProviderMutation = graphql`
  mutation PilotMutationsRevokeProviderMutation($providerUuid: String!) {
    revokeProviderWorkspaceAccess(providerUuid: $providerUuid) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsAssignWorkMutation = graphql`
  mutation PilotMutationsAssignWorkMutation(
    $providerUuid: String!
    $scopeType: String!
    $eventTypeId: Int
    $visitUuid: String
    $dueDate: String
    $notes: String!
  ) {
    assignProviderWork(
      providerUuid: $providerUuid
      scopeType: $scopeType
      eventTypeId: $eventTypeId
      visitUuid: $visitUuid
      dueDate: $dueDate
      notes: $notes
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsRespondAssignmentMutation = graphql`
  mutation PilotMutationsRespondAssignmentMutation(
    $assignmentUuid: String!
    $decision: String!
    $responseNote: String!
  ) {
    respondProviderAssignment(
      assignmentUuid: $assignmentUuid
      decision: $decision
      responseNote: $responseNote
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsSetSourceInclusionMutation = graphql`
  mutation PilotMutationsSetSourceInclusionMutation(
    $providerUuid: String!
    $includeInCombinedReporting: Boolean!
    $notes: String!
  ) {
    setProviderSourceInclusion(
      providerUuid: $providerUuid
      includeInCombinedReporting: $includeInCombinedReporting
      notes: $notes
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsPreviewCsvImportMutation = graphql`
  mutation PilotMutationsPreviewCsvImportMutation(
    $providerUuid: String!
    $csvText: String!
    $mappingUuid: String
    $presetKey: String
    $columnMapJson: String
  ) {
    previewProviderCsvImport(
      providerUuid: $providerUuid
      csvText: $csvText
      mappingUuid: $mappingUuid
      presetKey: $presetKey
      columnMapJson: $columnMapJson
    ) {
      headers
      resolvedMapJson
      totalRows
      createdCount
      updatedCount
      unchangedCount
      reviewCount
      errorCount
      rows {
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

export const PilotMutationsCommitCsvImportMutation = graphql`
  mutation PilotMutationsCommitCsvImportMutation(
    $providerUuid: String!
    $csvText: String!
    $filename: String!
    $mappingUuid: String
    $presetKey: String
    $columnMapJson: String
    $saveMappingName: String
    $isHistorical: Boolean!
  ) {
    commitProviderCsvImport(
      providerUuid: $providerUuid
      csvText: $csvText
      filename: $filename
      mappingUuid: $mappingUuid
      presetKey: $presetKey
      columnMapJson: $columnMapJson
      saveMappingName: $saveMappingName
      isHistorical: $isHistorical
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsResolveImportRowMutation = graphql`
  mutation PilotMutationsResolveImportRowMutation(
    $rowUuid: String!
    $retailerId: Int
    $confirmedStoreNumber: String
    $confirmedAddress: String
    $confirmedCity: String
    $confirmedState: String
    $saveStoreAlias: Boolean!
    $productId: Int
    $saveProductAlias: Boolean!
  ) {
    resolveProviderImportRow(
      rowUuid: $rowUuid
      retailerId: $retailerId
      confirmedStoreNumber: $confirmedStoreNumber
      confirmedAddress: $confirmedAddress
      confirmedCity: $confirmedCity
      confirmedState: $confirmedState
      saveStoreAlias: $saveStoreAlias
      productId: $productId
      saveProductAlias: $saveProductAlias
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsUpsertAgreementMutation = graphql`
  mutation PilotMutationsUpsertAgreementMutation(
    $providerUuid: String!
    $name: String!
    $contractedDemoFee: String
    $includedHours: String!
    $extraHourRate: String
    $mileageRate: String
    $adminFeePercent: String!
    $adminFeeBases: [String!]
    $taxPercent: String!
  ) {
    upsertProviderAgreement(
      providerUuid: $providerUuid
      name: $name
      contractedDemoFee: $contractedDemoFee
      includedHours: $includedHours
      extraHourRate: $extraHourRate
      mileageRate: $mileageRate
      adminFeePercent: $adminFeePercent
      adminFeeBases: $adminFeeBases
      taxPercent: $taxPercent
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsUpsertCostLineMutation = graphql`
  mutation PilotMutationsUpsertCostLineMutation(
    $visitUuid: String!
    $category: String!
    $sourceType: String!
    $amount: String
    $isConfirmedZero: Boolean!
    $description: String!
    $settlementStatus: String!
    $evidenceStatus: String
    $providerUuid: String
  ) {
    upsertBrandCostLine(
      visitUuid: $visitUuid
      category: $category
      sourceType: $sourceType
      amount: $amount
      isConfirmedZero: $isConfirmedZero
      description: $description
      settlementStatus: $settlementStatus
      evidenceStatus: $evidenceStatus
      providerUuid: $providerUuid
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsAllocateSharedCostMutation = graphql`
  mutation PilotMutationsAllocateSharedCostMutation(
    $totalAmount: String!
    $category: String!
    $allocationsJson: String!
    $allocationMode: String!
    $description: String!
    $providerUuid: String
  ) {
    allocateSharedVisitCost(
      totalAmount: $totalAmount
      category: $category
      allocationsJson: $allocationsJson
      allocationMode: $allocationMode
      description: $description
      providerUuid: $providerUuid
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsAssignExceptionMutation = graphql`
  mutation PilotMutationsAssignExceptionMutation(
    $exceptionUuid: String!
    $ownerUserId: Int
  ) {
    assignFinanceException(
      exceptionUuid: $exceptionUuid
      ownerUserId: $ownerUserId
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsAttachExceptionProofMutation = graphql`
  mutation PilotMutationsAttachExceptionProofMutation(
    $exceptionUuid: String!
    $proofUrl: String!
    $label: String!
    $isItemized: Boolean!
    $verifiedAmount: String
  ) {
    attachFinanceExceptionProof(
      exceptionUuid: $exceptionUuid
      proofUrl: $proofUrl
      label: $label
      isItemized: $isItemized
      verifiedAmount: $verifiedAmount
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsFixExceptionMatchMutation = graphql`
  mutation PilotMutationsFixExceptionMatchMutation(
    $exceptionUuid: String!
    $visitUuid: String!
    $category: String!
  ) {
    fixFinanceExceptionMatch(
      exceptionUuid: $exceptionUuid
      visitUuid: $visitUuid
      category: $category
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsClarifyExceptionMutation = graphql`
  mutation PilotMutationsClarifyExceptionMutation(
    $exceptionUuid: String!
    $note: String!
  ) {
    requestFinanceExceptionClarification(
      exceptionUuid: $exceptionUuid
      note: $note
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsResolveExceptionMutation = graphql`
  mutation PilotMutationsResolveExceptionMutation(
    $exceptionUuid: String!
    $resolutionStatus: String!
    $reason: String!
    $updatedAmount: String
  ) {
    resolveFinanceException(
      exceptionUuid: $exceptionUuid
      resolutionStatus: $resolutionStatus
      reason: $reason
      updatedAmount: $updatedAmount
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsImportPosMutation = graphql`
  mutation PilotMutationsImportPosMutation(
    $retailerBanner: String!
    $csvText: String!
    $filename: String!
    $feedCompleteness: String!
    $columnMapJson: String
  ) {
    importRetailerPosSales(
      retailerBanner: $retailerBanner
      csvText: $csvText
      filename: $filename
      feedCompleteness: $feedCompleteness
      columnMapJson: $columnMapJson
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsResolvePosRowMutation = graphql`
  mutation PilotMutationsResolvePosRowMutation(
    $rowUuid: String!
    $retailerId: Int
    $storeKey: String
    $storeLabel: String
    $productId: Int
    $saveProductAlias: Boolean!
  ) {
    resolveUnmatchedPosRow(
      rowUuid: $rowUuid
      retailerId: $retailerId
      storeKey: $storeKey
      storeLabel: $storeLabel
      productId: $productId
      saveProductAlias: $saveProductAlias
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsLinkCrewPurchaseMutation = graphql`
  mutation PilotMutationsLinkCrewPurchaseMutation(
    $visitUuid: String!
    $productId: Int!
    $unitsPurchased: Int!
    $purchaseDate: String
    $retailerBanner: String!
    $transactionRef: String!
  ) {
    linkCrewPurchaseAdjustment(
      visitUuid: $visitUuid
      productId: $productId
      unitsPurchased: $unitsPurchased
      purchaseDate: $purchaseDate
      retailerBanner: $retailerBanner
      transactionRef: $transactionRef
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsSetContributionMutation = graphql`
  mutation PilotMutationsSetContributionMutation($contributionPerUnit: String!) {
    setWorkspaceDefaultContribution(contributionPerUnit: $contributionPerUnit) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsCreateStoreActionMutation = graphql`
  mutation PilotMutationsCreateStoreActionMutation(
    $findingId: String!
    $actionType: String!
    $selectedStoreKey: String
    $idempotencyKey: String
    $providerUuid: String
    $ownerUserId: Int
    $targetDate: String
    $dueDate: String
    $budgetAmount: String
    $holdReason: String!
    $nextReviewDate: String
    $notes: String!
  ) {
    createStoreInsightAction(
      findingId: $findingId
      actionType: $actionType
      selectedStoreKey: $selectedStoreKey
      idempotencyKey: $idempotencyKey
      providerUuid: $providerUuid
      ownerUserId: $ownerUserId
      targetDate: $targetDate
      dueDate: $dueDate
      budgetAmount: $budgetAmount
      holdReason: $holdReason
      nextReviewDate: $nextReviewDate
      notes: $notes
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsRespondStoreActionMutation = graphql`
  mutation PilotMutationsRespondStoreActionMutation(
    $actionUuid: String!
    $decision: String!
    $note: String!
  ) {
    respondStoreInsightAction(
      actionUuid: $actionUuid
      decision: $decision
      note: $note
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsReassignStoreActionMutation = graphql`
  mutation PilotMutationsReassignStoreActionMutation(
    $actionUuid: String!
    $newProviderUuid: String!
    $note: String!
  ) {
    reassignStoreInsightActionProvider(
      actionUuid: $actionUuid
      newProviderUuid: $newProviderUuid
      note: $note
    ) {
      ok
      error
      targetUuid
    }
  }
`;

export const PilotMutationsVerifyRestockMutation = graphql`
  mutation PilotMutationsVerifyRestockMutation(
    $actionUuid: String!
    $verificationMethod: String!
    $verificationNote: String!
    $followupVisitUuid: String
  ) {
    verifyRestockStoreAction(
      actionUuid: $actionUuid
      verificationMethod: $verificationMethod
      verificationNote: $verificationNote
      followupVisitUuid: $followupVisitUuid
    ) {
      ok
      error
      targetUuid
    }
  }
`;
