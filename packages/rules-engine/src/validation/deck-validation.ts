import { RULES_CONFIG } from "@tcgtycoon/balance";
import type { CardDefinition, DeckDefinition } from "@tcgtycoon/domain";
import type { ValidationIssue, ValidationResult } from "./card-validation";

const NEUTRAL_FACTION_ID = "neutral";

export function validateDeck(
  deck: DeckDefinition,
  cards: readonly CardDefinition[],
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const copyCounts = new Map<string, number>();
  let deckSize = 0;

  if (deck.factionId === NEUTRAL_FACTION_ID) {
    issues.push({
      code: "INVALID_DECK_FACTION",
      message: "A constructed deck must choose one non-Neutral faction.",
      entityId: deck.id,
    });
  }

  for (const entry of deck.cards) {
    const runtimeCount = entry.count as number;
    if (runtimeCount !== 1 && runtimeCount !== 2) {
      issues.push({
        code: "INVALID_COUNT",
        message: `Deck entry ${entry.cardId} has invalid count ${runtimeCount}; expected 1 or 2.`,
        entityId: entry.cardId,
      });
      continue;
    }

    deckSize += runtimeCount;
    copyCounts.set(
      entry.cardId,
      (copyCounts.get(entry.cardId) ?? 0) + runtimeCount,
    );

    const card = cardsById.get(entry.cardId);
    if (card === undefined) {
      issues.push({
        code: "CARD_NOT_FOUND",
        message: `Deck references missing card ${entry.cardId}.`,
        entityId: entry.cardId,
      });
      continue;
    }

    if (
      card.factionId !== deck.factionId &&
      card.factionId !== NEUTRAL_FACTION_ID
    ) {
      issues.push({
        code: "FACTION_MISMATCH",
        message: `Card ${card.id} does not belong to deck faction ${deck.factionId}.`,
        entityId: card.id,
      });
    }
  }

  if (deckSize !== RULES_CONFIG.deckSize) {
    issues.push({
      code: "DECK_SIZE",
      message: `Deck contains ${deckSize} cards; expected ${RULES_CONFIG.deckSize}.`,
      entityId: deck.id,
    });
  }

  for (const [cardId, count] of copyCounts) {
    if (count > RULES_CONFIG.normalCopyLimit) {
      issues.push({
        code: "COPY_LIMIT",
        message: `Deck contains ${count} copies of ${cardId}; maximum is ${RULES_CONFIG.normalCopyLimit}.`,
        entityId: cardId,
      });
    }
  }

  return issues.length === 0
    ? { valid: true, issues: [] }
    : { valid: false, issues };
}
