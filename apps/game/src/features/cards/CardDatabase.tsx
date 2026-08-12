import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  KEYWORDS,
  type WorldState,
} from "../../../../../packages/domain/src/index";
import type { DeepReadonly } from "../../app/game-session/GameSessionController";
import {
  selectCards,
  type CardListFilters,
  type CardSort,
} from "../../selectors/cards";

export type CardDatabaseProps = {
  world: DeepReadonly<WorldState>;
};

export function CardDatabase({ world }: CardDatabaseProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CardSort>("NAME");
  const [legality, setLegality] = useState<
    NonNullable<CardListFilters["legality"]> | "ALL"
  >("ALL");
  const [factionId, setFactionId] = useState("ALL");
  const [rarity, setRarity] = useState("ALL");
  const [cardType, setCardType] = useState("ALL");
  const [expansionId, setExpansionId] = useState("ALL");
  const [cost, setCost] = useState("ALL");
  const [keyword, setKeyword] = useState("ALL");
  const [minimumUsageRate, setMinimumUsageRate] = useState(0);
  const [minimumMarketPrice, setMinimumMarketPrice] = useState(0);
  const expansionIds = Object.values(world.expansions)
    .map((expansion) => expansion.id)
    .sort();
  const factionIds = [
    ...new Set(Object.values(world.cards).map((card) => card.factionId)),
  ].sort();
  const cards = useMemo(
    () =>
      selectCards(
        world,
        {
          query,
          ...(legality === "ALL" ? {} : { legality }),
          ...(factionId === "ALL"
            ? {}
            : {
                factionId: factionId as NonNullable<
                  CardListFilters["factionId"]
                >,
              }),
          ...(rarity === "ALL"
            ? {}
            : { rarity: rarity as NonNullable<CardListFilters["rarity"]> }),
          ...(cardType === "ALL"
            ? {}
            : { type: cardType as NonNullable<CardListFilters["type"]> }),
          ...(expansionId === "ALL"
            ? {}
            : {
                expansionId: expansionId as NonNullable<
                  CardListFilters["expansionId"]
                >,
              }),
          ...(cost === "ALL" ? {} : { cost: Number(cost) }),
          ...(keyword === "ALL"
            ? {}
            : {
                keyword: keyword as NonNullable<CardListFilters["keyword"]>,
              }),
          minimumUsageRate,
          minimumMarketPrice,
        },
        sort,
      ),
    [
      cardType,
      cost,
      expansionId,
      factionId,
      keyword,
      legality,
      minimumMarketPrice,
      minimumUsageRate,
      query,
      rarity,
      sort,
      world,
    ],
  );

  return (
    <section className="space-y-4" aria-labelledby="card-database-title">
      <div>
        <h2 id="card-database-title" className="text-xl font-semibold">
          Card Database
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Search live CardDefinitions and observed public performance.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="grid gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Search
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Legality
          </span>
          <select
            value={legality}
            onChange={(event) =>
              setLegality(event.target.value as typeof legality)
            }
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          >
            <option value="ALL">All</option>
            <option value="LEGAL">Legal</option>
            <option value="RESTRICTED">Restricted</option>
            <option value="BANNED">Banned</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Set
          </span>
          <select
            value={expansionId}
            onChange={(event) => setExpansionId(event.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          >
            <option value="ALL">All</option>
            {expansionIds.map((id) => (
              <option key={id} value={id}>
                {world.expansions[id]?.name ?? id}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Faction
          </span>
          <select
            value={factionId}
            onChange={(event) => setFactionId(event.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          >
            <option value="ALL">All</option>
            {factionIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Rarity
          </span>
          <select
            value={rarity}
            onChange={(event) => setRarity(event.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          >
            <option value="ALL">All</option>
            {(["COMMON", "UNCOMMON", "RARE", "LEGENDARY"] as const).map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Type
          </span>
          <select
            value={cardType}
            onChange={(event) => setCardType(event.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          >
            <option value="ALL">All</option>
            <option value="UNIT">Unit</option>
            <option value="SPELL">Spell</option>
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Cost
          </span>
          <select
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          >
            <option value="ALL">All</option>
            {Array.from({ length: 9 }, (_, value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Keyword
          </span>
          <select
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          >
            <option value="ALL">All</option>
            {KEYWORDS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Minimum usage %
          </span>
          <input
            type="number"
            min={0}
            max={100}
            value={minimumUsageRate * 100}
            onChange={(event) =>
              setMinimumUsageRate(Number(event.target.value) / 100)
            }
            className="w-32 rounded border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Minimum price
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={minimumMarketPrice}
            onChange={(event) =>
              setMinimumMarketPrice(Number(event.target.value))
            }
            className="w-32 rounded border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Sort
          </span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as CardSort)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2"
          >
            <option value="NAME">Name</option>
            <option value="COST">Cost</option>
            <option value="USAGE">Usage</option>
            <option value="MARKET_PRICE">Market price</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-3">Card</th>
              <th className="px-3 py-3">Set</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">Cost</th>
              <th className="px-3 py-3">Legality</th>
              <th className="px-3 py-3">Usage</th>
              <th className="px-3 py-3">Market</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {cards.map((card) => (
              <tr key={card.id}>
                <td className="px-3 py-3">
                  <Link
                    to={`/cards/${card.id}`}
                    className="font-medium text-emerald-300"
                  >
                    {card.name}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {card.factionId} · {card.rarity}
                  </p>
                </td>
                <td className="px-3 py-3">
                  {card.expansionIds.join(", ") || "Unprinted"}
                </td>
                <td className="px-3 py-3">{card.type}</td>
                <td className="px-3 py-3">{card.cost}</td>
                <td className="px-3 py-3">{card.legality}</td>
                <td className="px-3 py-3">
                  {(card.usageRate * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-3">
                  {card.market.lastPrice === null
                    ? "No trades"
                    : `$${card.market.lastPrice.toFixed(2)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
