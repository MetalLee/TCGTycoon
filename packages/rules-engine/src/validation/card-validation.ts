import { cardDefinitionSchema } from "@tcgtycoon/domain";

export type ValidationIssue = {
  code: string;
  message: string;
  entityId?: string;
};

export type ValidationResult =
  { valid: true; issues: [] } | { valid: false; issues: ValidationIssue[] };

export function validateCardDefinition(card: unknown): ValidationResult {
  const result = cardDefinitionSchema.safeParse(card);

  if (result.success) {
    return { valid: true, issues: [] };
  }

  const entityId =
    typeof card === "object" &&
    card !== null &&
    "id" in card &&
    typeof card.id === "string"
      ? card.id
      : undefined;

  return {
    valid: false,
    issues: result.error.issues.map((issue) => ({
      code: "INVALID_CARD",
      message: `${issue.path.join(".") || "card"}: ${issue.message}`,
      ...(entityId === undefined ? {} : { entityId }),
    })),
  };
}
