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
};

export type ProductSku = {
  id: ProductId;
  expansionId: ExpansionId;
  name: string;
  kind: "BOOSTER" | "STARTER";
  msrp: number;
};

export type PrintRun = {
  id: PrintRunId;
  productId: ProductId;
  quantity: number;
  completionDay: number;
};
