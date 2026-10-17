export type RecapCommentItem = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string | null;
};

export const MAX_RECAP_COMMENT_LENGTH = 2000;

export function validateRecapComment(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return "Write a comment or question first.";
  if (trimmed.length > MAX_RECAP_COMMENT_LENGTH)
    return `Keep it under ${MAX_RECAP_COMMENT_LENGTH} characters.`;
  return null;
}
