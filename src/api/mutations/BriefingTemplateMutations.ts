import { graphql } from "react-relay";

export const CreateBriefingTemplateMutation = graphql`
  mutation BriefingTemplateMutations_CreateMutation(
    $input: CreateBriefingTemplateInput!
  ) {
    createBriefingTemplate(input: $input) {
      success
      message
      briefingTemplate {
        id
        uuid
        name
        title
        body
        isArchived
        attachments {
          uuid
          name
          url
          contentType
          size
        }
      }
    }
  }
`;

export const UpdateBriefingTemplateMutation = graphql`
  mutation BriefingTemplateMutations_UpdateMutation(
    $input: UpdateBriefingTemplateInput!
  ) {
    updateBriefingTemplate(input: $input) {
      success
      message
      briefingTemplate {
        id
        uuid
        name
        title
        body
        isArchived
        attachments {
          uuid
          name
          url
          contentType
          size
        }
      }
    }
  }
`;

export const ArchiveBriefingTemplateMutation = graphql`
  mutation BriefingTemplateMutations_ArchiveMutation(
    $input: ArchiveBriefingTemplateInput!
  ) {
    archiveBriefingTemplate(input: $input) {
      success
      message
      briefingTemplate {
        id
        uuid
        isArchived
      }
    }
  }
`;

export const SetJobBriefingMutation = graphql`
  mutation BriefingTemplateMutations_SetJobBriefingMutation(
    $input: SetJobBriefingInput!
  ) {
    setJobBriefing(input: $input) {
      success
      message
      jobUuid
      title
    }
  }
`;

export const ApplyBriefingTemplateMutation = graphql`
  mutation BriefingTemplateMutations_ApplyMutation(
    $input: ApplyBriefingTemplateInput!
  ) {
    applyBriefingTemplate(input: $input) {
      success
      message
      jobUuid
      title
    }
  }
`;
