export type Brand<T, B extends string> = T & { readonly __brand: B };

export type CardId = Brand<string, "CardId">;
export type DeckId = Brand<string, "DeckId">;
export type FactionId = Brand<string, "FactionId">;
export type PlayerId = Brand<string, "PlayerId">;
export type MatchId = Brand<string, "MatchId">;
export type PrintingId = Brand<string, "PrintingId">;

export const cardId = (value: string) => value as CardId;
export const deckId = (value: string) => value as DeckId;
export const factionId = (value: string) => value as FactionId;
export const playerId = (value: string) => value as PlayerId;
export const matchId = (value: string) => value as MatchId;
export const printingId = (value: string) => value as PrintingId;
