import type {
  CardId,
  ExpansionId,
  PrintRunId,
  PrintingId,
  ProductId,
} from "./ids";

export type Expansion = {
  id: ExpansionId;
  name: string;
};

export type Printing = {
  id: PrintingId;
  cardId: CardId;
  expansionId: ExpansionId;
  edition: PrintingEdition;
  sourceProductId: ProductId;
  sourceExpansionId: ExpansionId;
};

export type PrintingEdition = "FIRST_EDITION" | "UNLIMITED" | "REPRINT";

export type ProductSku = {
  id: ProductId;
  expansionId: ExpansionId;
  name: string;
  kind: "BOOSTER" | "STARTER";
  msrp: number;
  cardIds: CardId[];
};

export type PrintRun = {
  id: PrintRunId;
  productId: ProductId;
  orderedQuantity: number;
  quantity: number;
  orderedDay: number;
  completionDay: number;
  unitCost: number;
  totalCost: number;
  status: "PRINTING" | "COMPLETED";
  edition?: PrintingEdition;
  printingIds: PrintingId[];
};
