# TCGTycoon Domain Glossary

Use these terms consistently in code, tests and UI.

## CardDefinition

Immutable gameplay identity/rules of a card after Finalize. It contains Card DSL semantics such as cost, stats, keywords, triggers/effects and faction. Different physical Printings may reference the same CardDefinition.

## Printing

One physical edition/version of a CardDefinition, such as Launch First Edition Normal, Launch First Edition Foil or later Reprint. Printing determines collector identity/market series, not gameplay semantics.

## ProductSku

A sellable publisher product, initially Booster or Starter Deck. Product definitions specify included sets/slots/content rules and MSRP.

## PrintRun

A paid physical production batch of a ProductSku with quantity, production cost, ordered day, completion day and production status.

## First Edition

Printing identity produced only from a product's first production run. Later product reprints cannot increase First Edition supply.

## Product Reprint

New production of an older Booster/Starter product. It creates later edition supply through the normal production/opening path.

## Targeted Reprint

A previously published CardDefinition included in a later product, creating a new Printing linked to the same gameplay rules.

## Collection

Physical Printings owned by a Persistent Sim Player or represented in aggregate cohort holdings. A live-world player needs enough owned copies of each CardDefinition used in a Deck.

## Persistent Sim Player

A deterministic representative individual with wallet/budget, Collection, Decks, knowledge, preferences, match/market history, satisfaction and lifecycle state. The world generally maintains hundreds, not one object per displayed Active Player.

## Population Cohort

Aggregated macro population with shared characteristics such as competitiveness, collector interest, price sensitivity, budget and churn risk. Cohorts allow the displayed audience to grow far beyond the number of Persistent Sim Players.

## Named Agent

A special Persistent Sim Player with stable identity, role, influence, memories and social presence. Generative AI may render its prose, but its actions/opinion stance/facts are selected structurally by deterministic simulation.

## KnowledgeState

What one player or public community is currently allowed to know about cards, decks and events. Ground Truth Meta is not automatically copied into KnowledgeState.

## DeckDefinition

A legal constructed 20-card list used by Rules Engine. It is a gameplay input snapshot.

## DeckGenome

A persistent/evolving deck concept with lineage, strategy vector, owner/origin, parent decks and generation. It produces legal DeckDefinitions for evaluation/play.

## Ground Truth

Canonical facts known by the simulation: actual match outcomes, holdings, supply, hidden deck performance samples, etc. Ground Truth is not automatically visible to the player or every simulated player.

## Public Knowledge

Facts/decks made broadly observable through matches, tournaments, community exposure and other discovery channels.

## Meta

Observed live competitive environment derived from actual match samples and public/deck adoption. It includes usage, sufficiently sampled win rates, matchup stats and deck costs.

## Meta Health

0–100 diagnostic metric composed from diversity, dominance, win-rate outliers, matchup polarization, accessibility and staleness adjustment. It is not a hidden “fun” stat and does not directly change results.

## Accessibility

How practically affordable/available it is for players to enter the TCG or acquire competitive decks. Inputs include Starter availability/price, deck costs and key-card scarcity.

## Hype

Attention/visibility, not positive sentiment. A scandal may increase Hype while decreasing sentiment and Trust.

## Collector Heat

Collector/speculative market activity including liquidity, volume, scarcity excitement, momentum and confidence. A high listed price without trades is not necessarily high Collector Heat.

## Brand Trust

Slow-moving belief that the publisher will operate the TCG fairly/reliably. Primarily reacts to sustained publisher decisions and fulfilled/broken commitments.

## Active Players

Macro count derived from population lifecycle state. It must not be directly incremented by a marketing event or streamer post.

## PublisherCommand

Typed player intent queued during decision phase, such as starting a Playtest, ordering production or scheduling a policy change. UI never mutates WorldState directly.

## WorldState

Normalized canonical simulation state for the current save/day. It contains IDs/maps for all entities and state required to deterministically advance the world.

## Daily Tick / simulateDay

Authoritative deterministic transition from one committed live day to the next, consuming WorldState + PublisherCommands + BalanceConfig.

## Daily Report

Structured post-simulation summary of high-impact facts and metric deltas. It is a view/report artifact derived from the committed day result.

## CommunityPostIntent

Deterministic structured social output containing author, topic, stance, sentiment, facts/references and precomputed numerical influence. Optional LLM prose renders this intent after simulation commit.

## Fact Packet

Bounded set of known facts/memories provided to the generative model for a Named Agent. It intentionally excludes hidden WorldState and unknown future decisions.

## Playtest

Internal pre-release search/simulation with virtual card access. Playtest bots are not constrained by physical Collections. Reports contain discovered evidence, never undiscovered hidden truth.

## Finalize

Irreversible rules-lock boundary for an expansion. After Finalize, MVP cannot alter gameplay cost/stats/keywords/effects through Errata.

## Ban

CardDefinition becomes illegal in official Standard Decks for the active BanlistVersion. Physical Printings remain owned/tradeable.

## Restrict

Normal copy limit for the CardDefinition becomes one instead of two in official Standard.

## BanlistVersion

Immutable policy snapshot with effective day, banned cards and restricted cards. Historical matches/tournaments refer to the version active at that time.

## Standard Rotation

MVP Standard legality contains the five most recent eligible sets. Releasing a sixth rotates the oldest out without deleting cards or collector history.

## WorldEvent

Structured occurrence with entity references and attention/sentiment/trust/collector context. Events provide causes/signals; they should not directly set downstream card prices or player counts.

## EcosystemRiskState

`STABLE`, `STRAINED`, `DECLINING`, `DEATH_SPIRAL`, or `TERMINAL`. This classifies current system dynamics; it must not apply an arbitrary global debuff simply because the label changed.

## SaveEnvelope

Versioned wrapper around canonical WorldState with schema, simulation, rules, balance and app versions plus world seed and timestamps.

## Derived State

Values that can be recomputed from canonical state, such as current deck cost/accessibility projections. Avoid persisting copies unless justified.

## Cache

Disposable performance optimization such as matchup samples. A cache must not become an unversioned second source of truth.
