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

  for (const entry of deck.cards) {
    deckSize += entry.count;
    copyCounts.set(
      entry.cardId,
      (copyCounts.get(entry.cardId) ?? 0) + entry.count,
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
