# TCGTycoon MVP Design Specification

**Status:** Approved design baseline, pending written-spec review  
**Date:** 2026-08-11  
**Product:** TCGTycoon / TCG Tycoon Simulator  
**Primary mode:** Single-player infinite publisher simulation  
**Platforms:** Web + PC desktop from one shared game application

---

## 1. Product vision

TCGTycoon is an AI-assisted physical TCG publisher simulation game. The player is the lead game designer and publisher of a new trading card game, not a card-game competitor.

The central fantasy is:

> **You design the cards. AI players create the history.**

The player creates a TCG brand, designs and releases physical cards, sets print quantities and prices, funds playtesting, runs tournaments and marketing, manages bans/restrictions/reprints, and attempts to keep the TCG commercially and socially alive.

The simulated community then decides what the game actually becomes. AI players buy real printed cards, open boosters, build decks, play deterministic matches, discover unexpected combos, propagate decks socially, trade cards on a simulated secondary market, become collectors or competitive stars, praise or criticize the publisher, and eventually create a persistent history for the TCG.

The game is an infinite sandbox. There is no fixed victory screen. The save continues while the TCG and company remain viable. Bankruptcy or ecosystem death ends the run.

### 1.1 Core design principles

1. **Simulation determines facts. Generative AI gives those facts a voice.**
2. **The player controls decisions, not outcomes.**
3. **Physical supply matters.** A card used in the live world must come from a real print run.
4. **Power is discovered through play, not declared by the designer.**
5. **Popularity, power, profitability and health are separate concepts.**
6. **Publisher decisions have lead time.** Players cannot instantly fix printed mistakes.
7. **The game remains playable without the online AI service.**
8. **The simulation is deterministic and reproducible for a given state, command set and simulation version.**

---

## 2. MVP boundaries

### 2.1 Included

- Create a custom TCG brand, theme and four factions.
- Fixed simple Hearthstone-like combat skeleton.
- Launch Set with 48 cards.
- Natural-language card ideation compiled into a fixed structured card DSL.
- AI completion of non-key cards in a set.
- Internal AI playtesting.
- Physical Booster and Starter Deck products.
- Real print runs, inventory and primary-market sales.
- Persistent card ownership and collections.
- Light supply/demand secondary market.
- AI deck building and evolutionary Meta discovery.
- Population cohorts, persistent simulated players and named AI personalities.
- Official tournaments with real simulated matches.
- Marketing campaigns.
- Ban, Restrict, Reprint, Counter Card and Standard Rotation operations.
- Community feed and official announcements.
- Daily turn simulation and Daily Report.
- Multiple independent save slots.
- Web and desktop builds sharing the same game logic and UI.

### 2.2 Explicitly excluded from MVP

- Player-controlled matches.
- Multiplayer.
- Weapons, Hero Powers, Hero Cards, Secrets or instant-response stack mechanics.
- Equipment, locations/fields or land/resource cards.
- Player-created victory conditions.
- Arbitrary scripts or arbitrary AI-created rule semantics.
- More than one faction per deck.
- Full Legacy competitive simulation.
- Card condition, grading, serial-numbered cards, misprints or sealed-box investing.
- Detailed distributors, stores, warehouses, countries, logistics or taxes.
- Employees, offices, hiring or HR simulation.
- Loans, investors, IPOs or company finance systems beyond cash flow.
- Full professional esports league/team management.
- Real-time AI chat with every NPC.
- Mobile-first UI.

---

## 3. Game lifecycle

### 3.1 New-game Setup Phase

A new save begins before the TCG has launched. The formal public game clock has not started; **Launch Day is Day 1**.

The Setup Phase is a special onboarding exception. It uses the same card-design and playtest systems but does not advance the public operational day counter or simulate a live player economy. Costs are still charged from the initial launch budget.

Setup flow:

1. Create TCG name, one-sentence setting and visual keywords.
2. Create/accept four faction concepts.
3. Define Launch Set design brief.
4. Generate a 48-slot set skeleton.
5. Player designs roughly 8–12 key/signature cards.
6. AI proposes the remaining cards.
7. Player performs Set Review and edits/rejects/regenerates cards.
8. Build four legal Starter Decks, one for each faction.
9. Run internal playtests at chosen depth.
10. Finalize Launch Set.
11. Set Booster and Starter MSRP and initial print runs.
12. Launch the TCG.
13. Enter **Day 1**.

### 3.2 Live daily loop

During each live day the simulation is paused while the publisher acts. The player may inspect data and schedule operations without a fixed action-point limit. Major operations have monetary costs, preparation times or cooldowns.

Typical decisions:

- Edit cards in non-finalized future expansions.
- Start a Playtest.
- Finalize an expansion.
- Schedule a print run or reprint.
- Change eligible product MSRP.
- Start a marketing campaign.
- Announce and schedule a tournament.
- Ban or Restrict a card.
- Publish an official announcement.

The player then chooses **End Day**. The deterministic daily simulation executes and produces the next state and Daily Report.

### 3.3 No fixed victory

The game records long-term milestones rather than imposing a final win condition. Examples include:

- Active-player milestones.
- Largest product launch.
- Most valuable printing.
- Longest healthy Meta.
- First/most impactful ban.
- Longest-running named champion.
- Longest TCG lifespan.
- Recovery from a Death Spiral.

---

## 4. Core TCG rules v1

The live TCG always uses one fixed rules skeleton in MVP. Theme and visible keyword names may be reskinned, but semantic identifiers remain fixed.

### 4.1 Deck and hero rules

| Rule | MVP value |
|---|---:|
| Hero health | 20 |
| Deck size | 20 cards |
| Copies of a card | Maximum 2 |
| Factions | Exactly 1 faction + Neutral cards |
| Card types | Unit, Spell |
| Starting hand, first player | 3 |
| Starting hand, second player | 4 |
| Second-player bonus | 1 Coin special card |
| Maximum hand | 10 |
| Battlefield unit slots | 5 |
| Maximum permanent resource | 8 |
| Draw per turn | 1 |

The Coin is not part of the constructed 20-card deck. It costs 0 and grants +1 temporary resource for the current turn.

### 4.2 Mulligan

Before the game starts, each player may return any number of starting cards and draw replacements. Returned cards cannot be redrawn until mulligan completion.

Battle AI decides mulligans using deck strategy, mana curve, matchup knowledge and card evaluation.

### 4.3 Turn structure

1. `START_OF_TURN` triggers resolve.
2. Increase maximum resource by 1 up to 8.
3. Refill current resource to the maximum.
4. Draw one card.
5. Main phase: play Units, play Spells and attack in any legal order.
6. `END_OF_TURN` triggers resolve.
7. Pass turn.

There is no separate response stack, combat step or second main phase.

### 4.4 Units and combat

Units have `cost`, `attack`, `health`, `keywords` and structured effects/triggers.

A newly summoned unit normally cannot attack that turn. Units may attack enemy units or the enemy hero when target rules permit. Unit combat deals attack damage simultaneously. A unit with health <= 0 dies.

Hero cards, weapons and hero attacks do not exist in MVP.

### 4.5 Spell rules

All spells are active, own-turn effects. The player pays the cost, selects legal targets and resolves effects. No instant-response or counter stack exists.

### 4.6 Fatigue

When a player must draw from an empty deck, that hero instead takes escalating fatigue damage: 1, then 2, then 3, etc.

### 4.7 Death and trigger resolution

After every action:

`Action -> State Check -> Death Queue -> Trigger Queue -> Resolve -> State Check`

Resolution continues until no pending state-based deaths or triggers remain.

Safety limits prevent infinite processing:

- `MAX_ACTIONS_PER_CHAIN = 100`
- `MAX_TRIGGER_DEPTH = 20`
- `MAX_SUMMONS_PER_CHAIN = 30`

Crossing a safety limit marks the match as a **Potential Infinite Combo** instead of hanging the simulation.

---

## 5. Core keyword set

MVP supports exactly these ten semantic keywords:

1. **TAUNT** — while an enemy Taunt unit is attackable, other enemy characters cannot be chosen as attack targets.
2. **CHARGE** — may attack units or hero on the turn it enters play.
3. **RUSH** — may attack units, but not the enemy hero, on the turn it enters play.
4. **BATTLECRY** — specified effect executes when normally played from hand.
5. **DEATHRATTLE** — specified effect executes after the unit dies.
6. **DIVINE_SHIELD** — first instance of damage is prevented and the shield is removed.
7. **LIFESTEAL** — actual damage dealt by the source heals its controller's hero by the same amount.
8. **WINDFURY** — unit may attack up to twice per turn.
9. **STEALTH** — cannot be selected by enemy attacks or enemy targeted effects; attacking removes Stealth.
10. **POISONOUS** — after dealing more than zero damage to a unit, destroys that unit. Damage fully prevented by Divine Shield does not trigger Poisonous.

A TCG theme may visually rename a keyword, but stored semantics remain these identifiers.

---

## 6. Card DSL and AI card design

### 6.1 Rule source of truth

The visible card text is never executable. The only rules source of truth is the structured Card DSL.

Every card stores:

- `CardDefinition` / DSL.
- Generated human-readable display text.
- Theme/flavor metadata.
- Optional art asset reference.

Changing display text cannot alter gameplay semantics.

### 6.2 Effect library

MVP structured effects include:

- `DEAL_DAMAGE`
- `HEAL`
- `DRAW`
- `DISCARD`
- `SUMMON`
- `DESTROY`
- `BUFF_ATTACK`
- `BUFF_HEALTH`
- `BUFF_STATS`
- `DEBUFF_ATTACK`
- `DEBUFF_HEALTH`
- `GAIN_KEYWORD`
- `REMOVE_KEYWORD`
- `CREATE_CARD`
- `COPY_CARD`
- `RETURN_TO_HAND`
- `GAIN_MANA_THIS_TURN`
- `GAIN_MAX_MANA`

Selectors include at least:

- `SELF`
- `FRIENDLY_UNIT`
- `ENEMY_UNIT`
- `ANY_UNIT`
- `FRIENDLY_HERO`
- `ENEMY_HERO`
- `ANY_CHARACTER`
- `RANDOM_ENEMY_UNIT`
- `ALL_ENEMY_UNITS`
- equivalent friendly/all selectors when required by supported effects.

### 6.3 Trigger library

Supported triggers include:

- `ON_PLAY`
- `ON_DEATH`
- `TURN_START`
- `TURN_END`
- `AFTER_ATTACK`
- `AFTER_DAMAGE`
- `AFTER_FRIENDLY_UNIT_DIES`
- `AFTER_ENEMY_UNIT_DIES`
- `AFTER_SPELL_PLAYED`

MVP limits:

- Maximum 2 triggers per card.
- Maximum 3 effects per trigger.
- Condition expressions are one level deep; no arbitrary nested Boolean trees.

### 6.4 AI-assisted card workflow

Player input may be natural language, e.g. “a cheap mechanical engine that becomes stronger as friendly machines die.”

Pipeline:

`Natural language -> AI design proposal -> structured card draft -> schema validation -> rules validation -> static risk heuristic -> player approval -> playable CardDefinition`

AI cannot invent unsupported triggers, keywords, selectors or effects. Unsupported concepts must be rejected or translated into an existing legal mechanic with explicit user-facing explanation.

The structured editor remains usable without online AI.

### 6.5 Static power analysis

Card Studio may estimate categories such as:

- Mana efficiency.
- Stats efficiency.
- Card advantage.
- Tempo.
- Removal/reach.
- Scaling.
- Synergy/loop risk.

The output is a risk class such as Low / Medium / High / Extreme, not a guaranteed win rate. Actual strength is discovered through playtesting and the live Meta.

---

## 7. Launch Set and products

### 7.1 Launch Set composition

Launch Set contains **48 CardDefinitions**:

- Four factions: roughly 10 cards each.
- Neutral: roughly 8 cards.

Initial rarity target:

- Common: 20.
- Uncommon: 14.
- Rare: 10.
- Legendary: 4.

The exact faction distribution may be adjusted by the approved set skeleton while preserving a playable single-faction + Neutral environment.

### 7.2 Booster Pack

**Each Booster contains exactly 5 physical cards.**

Default slot structure:

- 3 Common.
- 1 Uncommon.
- 1 Rare+.

Default Rare+ configuration:

- Rare: 87.5%.
- Legendary: 12.5%.

These are BalanceConfig values, not hard-coded product assumptions.

Foil and Alt-Art are printing-variant upgrades of one of the five opened cards and **never add a sixth card**.

### 7.3 Printing variants

MVP supports:

- Normal.
- Foil.
- Alt-Art.

No Foil Alt-Art combination is required for MVP.

Only approximately 8–12 key/signature cards plus set/product visuals need dedicated AI-generated art in MVP. Other cards may use faction/shared procedural presentation assets.

### 7.4 Starter Decks

Launch includes four Starter Deck SKUs, one per faction. Each is a legal 20-card deck.

Starter cards are real tradeable physical printings. The player may include valuable cards in Starter products, allowing naturally emerging Starter arbitrage and supply effects.

---

## 8. Physical economy

### 8.1 Card and printing separation

- **CardDefinition** = game rules.
- **Printing** = a physical edition/version of a CardDefinition.
- **ProductSKU** = Booster or Starter product.
- **PrintRun** = an actual manufactured batch.

Different Printings of the same CardDefinition are identical for gameplay but may differ in collector value.

### 8.2 Physical supply conservation

Live-world physical cards do not appear from formulas. They enter the world only through Print Runs and opened Product SKUs.

Cards are held by:

- Persistent-player collections.
- Named-agent collections.
- Aggregated cohort holdings.
- Seller inventory represented by those holdings.

A sold card changes ownership. Negative inventory or selling cards that do not exist is invalid state.

### 8.3 First Edition and reprints

The first Print Run of a product creates **First Edition** printings. Later product reprints create non-First-Edition/Unlimited printings.

Targeted reprints inside later products create new Printing IDs linked to the same CardDefinition.

Reprinting may reduce competitive scarcity without erasing First Edition historical/collector identity.

### 8.4 Printing and inventory

Print Runs:

- Cost cash at order time.
- Have completion days.
- Cannot be cancelled once printing begins.
- Create Publisher Inventory only on completion.

Large runs receive configurable unit-cost economies of scale but create inventory and cash-risk exposure.

Inventory holding cost is abstracted. Detailed warehouse/logistics simulation is excluded.

### 8.5 Primary market

The player controls MSRP. The retail channel is abstracted.

Company revenue is a configurable publisher share of retail sales rather than necessarily the full MSRP. Default balance target may begin around 65% but remains configurable.

MSRP changes have cooldown/channel friction; initial design target is no more than one change to a SKU within 7 days.

### 8.6 Product demand

Booster demand is driven by factors including:

- Set freshness.
- Competitive card demand.
- Collector appeal.
- Hype/exposure.
- Expected pack value for market-aware player types.
- Price affordability.
- Brand trust.

Starter demand is driven by:

- New-player conversion.
- Faction popularity.
- Starter strength.
- Upgrade potential.
- Included card value.
- Price and stock.

In MVP, purchased Boosters and Starters are opened immediately. Sealed product speculation is excluded.

### 8.7 Secondary market

The publisher cannot buy/sell cards or set secondary-market prices.

Players/cohorts generate structured Buy and Sell Intents with quantity and reservation prices. Each Printing is resolved using a lightweight daily call-auction/clearing-price model.

Every Printing records at least:

- Last price.
- Daily volume.
- Available supply/liquidity indicators.
- Price history.

Deck cost uses the cheapest currently available legal Printing of each required CardDefinition, not premium collector versions.

### 8.8 Collector demand

Collector willingness-to-pay may depend on:

- Scarcity.
- Card rarity.
- First Edition status.
- Foil / Alt-Art.
- Character/art appeal.
- Historical significance.
- Set prestige.
- Price momentum.

Historical tags may include first championship card, first banned card, Meta-defining card, infamous combo, iconic character or record price.

Ban does not force collector value to zero. Competitive utility and collector demand are separate.

---

## 9. AI society model

### 9.1 Three layers

#### Population Cohorts

Represents macro populations from thousands to 100k+ without one full object per user. Cohort parameters include skill, competitiveness, collector interest, price sensitivity, budget, loyalty and churn risk.

#### Persistent Sim Players

Initial target: **400**, dynamically maintained around **300–1000** as representative individuals.

Each persists with:

- Wallet/budget.
- Real Collection.
- Decks.
- Preferences.
- Knowledge state.
- Match/tournament history.
- Market behavior.
- Satisfaction/activity.

#### Named Agents

Initial target: **24**. Named Agents are special persistent players with role/personality/influence/long-term memory and optional LLM-rendered expression.

Suggested initial role distribution:

- Professional players: 5.
- Brewers/theorycrafters: 4.
- Streamers/content creators: 5.
- Collectors: 4.
- Card-store personalities: 3.
- Community commentators: 3.

### 9.2 Player motivations

Simulation uses continuous preference vectors rather than mandatory single labels. Important motivations include:

- Competitive.
- Brewer/experimental.
- Casual/fun.
- Collector.
- Budget-sensitive.
- Whale/high-spend.

### 9.3 Ownership requirement

A live-world player must own the required physical cards to register a legal Deck. Playtest bots are exempt and have virtual access to the test card pool.

A player selling a required card may make a Deck illegal/missing cards and must reacquire or rebuild before using it.

### 9.4 Knowledge model

**Ground Truth** and **Public/Individual Knowledge** are distinct.

A player may know cards/decks through:

- Personal collection.
- Personal matches.
- Opponents.
- Public tournament lists.
- Community content.
- Followed Named Agents.

A powerful deck can exist without being widely known.

---

## 10. Deck discovery and Meta evolution

### 10.1 Deck construction

Deck building is local deterministic code, not LLM generation.

Process:

`Generate -> Evaluate -> Mutate -> Compete -> Retain`

Heuristic player preferences guide search but do not define hard-coded Archetypes.

Examples:

- Aggressive players weight low curve, attack efficiency, Charge and direct damage.
- Control players weight removal, draw, healing, Taunt and high-value late game.
- Brewers weight trigger/effect synergies, unusual interactions and low-usage cards.

### 10.2 Card synergy graph

The simulation derives candidate relationships between triggers/effects/conditions. High synergy increases exploration probability but does not prove a deck is strong.

### 10.3 Deck Genome

Decks persist as evolving genomes with:

- Faction.
- Card counts.
- Strategy vector.
- Origin player.
- Parent deck IDs.
- Generation/version.

Small mutations replace a limited number of cards or copy counts. Deck evolution is continuous rather than random full rebuilds.

### 10.4 Exploration

Each player has an `explorationRate`. Brewers explore substantially more than optimized professional players. This prevents the world from freezing after the first dominant deck is found.

### 10.5 Combo discovery

A relationship becomes a **Discovered Strategy/Combo** only when actual simulation evidence supports it, such as repeated successful activation, strong performance contribution, or trigger-safety-limit events.

Discovery initially belongs to specific players. Knowledge spreads through matches, tournaments, social content and influencers.

### 10.6 Deck adoption

Adoption uses a configurable score based on:

- Performance fit.
- Preference fit.
- Social exposure.
- Tournament prestige.
- Influencer exposure.
- Novelty.
- Deck-cost penalty.
- Missing-card penalty.
- Complexity penalty.

This allows a 63% theoretical deck to have low usage if its cards are unaffordable, while a weak meme deck can become temporarily popular after influencer exposure.

### 10.7 Meta data

For sufficiently sampled live decks, track:

- Matches.
- Observed win rate.
- Usage rate.
- Matchups.
- Average game length.
- Cheapest legal deck cost.
- Discovery/adoption history.

Small samples must be labelled low confidence rather than presented as precise conclusions.

---

## 11. Named agents and community

### 11.1 Named-agent structure

Each agent has structured data such as:

- Identity and role.
- Personality traits.
- Favorite faction/style.
- Risk tolerance.
- Brand attitude.
- Influence/follower count.
- Relationships.
- Recent structured memories.
- Compressed long-term summary.

### 11.2 Fact packets

LLM generation receives only facts the agent is allowed to know. It cannot invent future official actions or hidden Meta facts.

Generated posts return structured metadata such as topic, stance, sentiment and referenced entities in addition to text.

### 11.3 Simulation before prose

Social numerical effects are determined locally before LLM prose is generated:

`Local social decision -> CommunityPostIntent -> simulation effects committed -> optional AI text rendering`

Different prose must not change the simulation result.

If AI is unavailable, the game displays deterministic/template text for the same CommunityPostIntent.

### 11.4 Community feed

Daily feed selects a small set of high-value items, generally about 3–8, from:

- Named-agent posts.
- Tournament results.
- New deck discoveries.
- Significant price moves.
- Product announcements.
- Official announcements.
- Milestones.
- Aggregate community sentiment.

Every post should link to real underlying entities where applicable.

---

## 12. Expansion development and playtest pipeline

### 12.1 Set sizes

After Launch Set, supported expansion sizes are:

| Size | Cards | Player key-card target | Base Design progress |
|---|---:|---:|---:|
| Small | 24 | 5–6 | 4 live days |
| Standard | 32 | 6–8 | 6 live days |
| Large | 36 | 8–10 | 8 live days |

Standard 32-card expansions are the default/common product size.

### 12.2 Pipeline

`Concept -> Design -> Playtest -> Finalize -> Printing -> Release -> Live`

After Day 1, project stages consume real daily ticks. Multiple projects may run concurrently; money is the primary limiting resource rather than employee slots.

### 12.3 Concept and skeleton

Set Brief defines:

- Name/theme.
- Focus factions.
- Intended strategic directions.
- Product positioning.
- Set size.

AI generates an editable design skeleton before proposing final cards so the set has coherent archetype/enabler/payoff/removal/utility structure.

### 12.4 Playtest tiers

Default balance targets:

| Tier | Live duration | Approx matches | Purpose |
|---|---:|---:|---|
| Quick | 1 day | 2,000 | Obvious issues |
| Standard | 3 days | 15,000 | Normal release confidence |
| Deep | 7 days | 75,000 | Wider Meta/combo search |

Actual values remain configurable for performance and balance.

Launch Setup uses these same test depths but does not advance the public Day counter.

Playtest reports may include:

- Predicted discovered deck environment.
- High-risk cards.
- Combo candidates.
- Infinite-chain warnings.
- First/second-player win rate.
- Average game length.
- Diversity estimate.
- Replays for anomalies.

Reports describe what testing discovered, never hidden absolute truth. “No critical combo discovered” is valid; “there are no critical combos” is not.

### 12.5 Revision invalidation

Gameplay DSL changes increment card revision and invalidate affected reports. Flavor/copy changes do not invalidate rules testing.

### 12.6 Finalize

Finalize is irreversible for gameplay rules. After finalization, cost/stats/keywords/effects cannot be changed. MVP has no functional Errata system.

The player may Finalize despite unresolved risk warnings or insufficient testing.

---

## 13. Publisher operations

### 13.1 Balance tools

The player may use:

- **Ban** — card illegal in official Standard.
- **Restrict** — maximum copies reduced from 2 to 1.
- **Reprint** — increase availability without changing gameplay semantics.
- **Counter Card** — solve a problem through a future expansion using legal DSL mechanics.
- **Rotation** — predictable set rotation rather than ad-hoc removal.

### 13.2 Ban timing

MVP provides:

- **Scheduled** change: default 3 days before effectiveness.
- **Emergency** change: effective next game day.

Community/market consequences depend on severity, card value, timing, tournament disruption and prior publisher behavior. Ban is not a free “fix Meta” button.

### 13.3 Banlist versions

Every rules-sensitive match/tournament stores its BanlistVersion and RuleVersion. Historical tournament results/replays remain tied to the policy state in force at the time.

### 13.4 Standard Rotation

**Standard contains the most recent five sets.** When a sixth Standard-eligible set releases, the oldest rotates out.

Rotated cards remain physical assets and continue collector/legacy-casual demand. MVP does not run a second full competitive Legacy Meta.

### 13.5 Tournaments

Supported event presets:

| Event | Players | Prep time |
|---|---:|---:|
| Local Open | 32 | 2 days |
| Regional | 128 | 5 days |
| Major | 512 | 10 days |

Tournament entrants require legal owned cards. Matches are actually simulated. Results create public deck knowledge, social exposure and subsequent demand/adoption changes.

### 13.6 Marketing campaigns

MVP campaign types:

- Social Media Ads.
- Streamer Sponsorship.
- New Player Campaign.
- Collector Campaign.
- Tournament Promotion.

Campaigns last 3/7/14 days and generate exposure to relevant cohorts rather than directly adding players or Hype points. A new-player campaign during Starter stockout should increase awareness while failing to convert many players.

### 13.7 Official announcements

The player may write free-form announcement copy but must select/bind a structured topic/action such as:

- Expansion reveal/release.
- Ban/Restrict.
- Reprint.
- Tournament.
- Development update.
- Issue response/apology.

Words alone do not directly grant Brand Trust. Structured commitments, when supported, are tracked and may improve or hurt trust based on fulfillment.

---

## 14. Daily simulation order

The authoritative live-day sequence is:

1. Activate scheduled policies.
2. Advance operations/projects.
3. Complete playtests and create reports.
4. Complete print runs.
5. Receive completed inventory.
6. Execute releases and rotation due today.
7. Advance marketing exposure.
8. Process player exposure/interest.
9. Process population/cohort lifecycle transitions.
10. Generate primary-product demand.
11. Resolve Booster/Starter sales.
12. Open purchased products.
13. Update physical collections/holdings.
14. Build/mutate eligible decks.
15. Simulate normal matches.
16. Run scheduled tournaments.
17. Update deck knowledge from matches/results.
18. Propagate strategies socially.
19. Generate secondary-market intents.
20. Clear secondary market and transfer ownership.
21. Update market prices/volume/liquidity.
22. Calculate card/deck accessibility.
23. Calculate cohort satisfaction targets/changes.
24. Process churn and returning-player behavior.
25. Produce structured community events/intents.
26. Commit social numerical effects.
27. Calculate Hype target and smoothing.
28. Calculate Collector Heat target and smoothing.
29. Calculate Meta Health.
30. Update Brand Trust.
31. Calculate operating/inventory/project expenses due today.
32. Apply Cash Ledger.
33. Validate World invariants.
34. Evaluate ecosystem risk state.
35. Check Game Over conditions.
36. Persist next state atomically.
37. Generate/attach Daily Report.
38. Optionally enrich community presentation with online AI after the deterministic state is committed.

AI text/image network calls are never inside the deterministic simulation transaction.

---

## 15. Player lifecycle and core metrics

### 15.1 Lifecycle

Macro lifecycle:

`Potential -> Interested -> New -> Active -> At Risk -> Churned`

with:

`Churned -> Returning -> Active`

New players have a roughly 7-day onboarding window before reliable retention is measured.

### 15.2 Active Players

Active Players is a real aggregate of population states, not a score calculated from Hype/Trust.

Daily reports should expose major flow contributors when useful, e.g. new activations, returns and churn.

### 15.3 Hype

Hype (0–100) measures attention, not approval. Positive launches and negative scandals may both raise it.

It uses a target/smoothing model with relatively fast response and natural decay when little occurs.

Community sentiment is maintained separately from Hype.

### 15.4 Collector Heat

Collector Heat (0–100) represents active collector/speculative interest and should consider:

- Trading volume.
- Liquidity.
- Price momentum.
- Scarcity excitement.
- Product freshness.
- Collector confidence.

High posted card price without actual trading does not imply high Collector Heat.

### 15.5 Meta Health

Default conceptual decomposition:

- Diversity: 25%.
- Dominance Health: 25%.
- Win-rate Health: 20%.
- Matchup Health: 15%.
- Accessibility Health: 15%.
- Additional configurable staleness penalty.

Weights live in BalanceConfig.

Diversity should use a continuous distribution metric such as normalized deck-usage entropy. Only sufficiently sampled decks contribute strongly to win-rate outlier calculations.

### 15.6 Brand Trust

Brand Trust (0–100) is slow-moving and primarily evaluates publisher behavior:

Positive examples:

- Reasonable handling of severe problems.
- Kept commitments.
- Reliable release operations.
- Useful reprints.
- Stable tournament support.

Negative examples:

- Severe unresolved Meta problems.
- Arbitrary/frequent bans.
- Repeated announced-release delays.
- Chronic shortages.
- Excessive product cadence.
- Broken commitments.

Player frustration affects cohort satisfaction first; only sustained publisher responsibility should materially affect Trust.

### 15.7 Cash

Cash is a real ledger, never smoothed.

Revenue in MVP comes primarily from Booster and Starter primary-market sales. Costs include:

- Print runs.
- Playtests.
- Expansion development.
- AI art generation where monetized in game balance.
- Marketing.
- Tournaments.
- Fixed operating cost.
- Inventory holding cost.

---

## 16. Supporting numerical models

### 16.1 Smoothing

For abstract 0–100 metrics, use a configurable target-response form:

`next = current + (target - current) * responseSpeed`

Response speeds differ by metric. Hype is fast; Brand Trust is slow.

### 16.2 Cohort satisfaction

Each cohort computes a target from weighted dimensions such as:

- Gameplay quality.
- Affordability.
- Novelty.
- Trust.
- Social activity.
- Collection experience.

Satisfaction moves gradually toward its target and drives At-Risk/churn behavior.

### 16.3 Accessibility

Internal Accessibility considers at least:

- Starter availability and price.
- Cheapest competitive deck.
- Median Meta deck cost.
- Scarcity of key cards.
- Budget-deck viability.

Accessibility affects new-player conversion, Budget satisfaction and Meta Health.

### 16.4 Product freshness and fatigue

Each set has declining Product Freshness. Marketing/tournaments may temporarily raise attention but cannot restore an old set to launch freshness.

Hidden Product Fatigue rises with excessive release cadence/recent spending and suppresses purchase propensity. There is no forced release cadence, but balance should make roughly 30–60 days per normal expansion a reasonable starting target rather than a hard rule.

### 16.5 Player budgets

Cohorts and persistent players have finite TCG spending capacity that recovers over time. Rapid releases therefore compete for the same player budgets rather than creating unlimited revenue.

### 16.6 Market reach

Potential market size uses a saturating model rather than infinite exponential growth. A `MarketReach`/addressable-audience concept limits easy acquisition as the active population approaches current reach. Strong long-term exposure and brand success may expand reach.

---

## 17. Ecosystem risk and Game Over

### 17.1 Risk states

Internal ecosystem state:

- `STABLE`
- `STRAINED`
- `DECLINING`
- `DEATH_SPIRAL`
- `TERMINAL`

These states describe existing system behavior; they should not apply arbitrary global “all revenue -50%” debuffs.

### 17.2 Death Spiral

Death Spiral emerges when multiple negative loops persist, such as declining players, low acquisition/churn ratio, low Hype, poor retention and deteriorating Trust.

Typical loop:

`Active Players down -> fewer matches/events/content -> lower exposure -> fewer new players -> lower sales -> lower operating capacity -> less content/support -> further player decline`

A Death Spiral can be reversed through improved product, Meta, onboarding/accessibility, events and correctly targeted marketing.

Successful recovery is a historical milestone.

### 17.3 Bankruptcy

Short negative cash may use a small configurable emergency-credit buffer approximately equivalent to a few days of mandatory operating cost. While insolvent, the player cannot start discretionary paid actions.

Bankruptcy occurs when the company exceeds the configured emergency credit limit or cannot recover under the defined insolvency rules.

### 17.4 Ecosystem death

Initial balance target for community death:

- Active Players < 100.
- Hype < 5.
- Both persist for 30 consecutive live days.

These thresholds are BalanceConfig values.

High Collector Heat alone cannot keep a playable TCG alive forever; a “zombie” collector-only TCG is allowed as an intermediate state.

---

## 18. User interface and information architecture

### 18.1 Primary navigation

Desktop/web primary navigation:

- Dashboard.
- Cards.
- Expansions.
- Playtest.
- Meta.
- Market.
- Community.
- Tournaments.
- Operations.

Global header shows key state such as:

- Active Players.
- Hype.
- Meta Health.
- Brand Trust.
- Cash.
- Current Day.
- End Day button.

Collector Heat may remain primarily on Dashboard to avoid overcrowding the global header.

### 18.2 End Day and Daily Report

Before simulation, End Day shows important unresolved warnings but always allows “Proceed Anyway.”

The Daily Report leads with 3–6 high-impact **Today’s Story** items, then a metric summary. It is the main daily feedback loop.

Examples:

- Breakout deck growth.
- Influencer post.
- Playtest completion.
- Inventory shortage.
- Tournament result.
- Major price move.

### 18.3 Dashboard

Dashboard answers:

1. Is the TCG healthy?
2. What is driving current change?
3. What products/operations need attention?
4. What happens next?

Key sections:

- Health Overview.
- Current Drivers.
- Product status.
- Operations Timeline.
- Community Pulse.
- Conservative Cash Runway.

Useful leading indicators include 7-day new-player retention and Acquisition/Churn ratio.

### 18.4 Cards and Card detail

Cards supports search/filter/sort by set, faction, rarity, type, cost, keyword, legality, usage and market data.

Card detail tabs:

- Overview.
- Performance.
- Market.
- History.

Cards simultaneously show what the designer created and what the live community did with it.

Only publicly discovered synergies are visible as Known Synergies.

### 18.5 Card Studio

Three conceptual areas:

- Set card list.
- Visual/structured card editor.
- AI Design Assistant.

Shows static power/combo/complexity risk without presenting hidden true strength.

### 18.6 Expansions and Set Review

Expansion page shows pipeline stage and progress. Set Review must allow bulk review of 24–36 generated cards, including accepting low-risk proposals, editing, deleting and regenerating selections.

### 18.7 Playtest

Playtest Report tabs may include:

- Overview.
- Decks.
- Cards.
- Matchups.
- Anomalies.
- Replays.

Anomalies such as unusually strong decks or long trigger chains must link to replay evidence.

### 18.8 Meta

Meta page displays Meta Health, deck usage, observed win rates, deck cost and explicit diagnostic reasons for unhealthy Meta.

Deck detail includes:

- 20-card list.
- Cost.
- Discovery lineage.
- Usage/win-rate history.
- Matchups.
- Tournament results.
- Discovery timeline.

### 18.9 Watch Match

Player never controls live combat, but important matches can be inspected using a simplified board + action timeline with play/pause/step/speed controls.

### 18.10 Market

Market separates:

- Cards / Printings.
- Products.

The publisher sees prices, volume, supply and product inventory but cannot trade single cards.

### 18.11 Community

Community feed categories may include Trending, Competitive, Collectors and Official. Posts link to real decks/cards/agents/tournaments/market objects.

Agent Profile shows role, influence, current deck, recent results/posts and persistent history.

### 18.12 Tournaments

Tournament UI supports Upcoming / Running / Completed and shows registrations, results, Top 8, deck distribution, breakout cards and notable matches.

### 18.13 Operations

Operations has:

- Calendar.
- Projects.
- Policies.

The Calendar should make the next 20–30 days of commitments readable at a glance.

### 18.14 Information semantics

The UI must visually distinguish:

- **FACT** — observed/saved simulation fact.
- **ESTIMATE** — model estimate based on available information.
- **OPINION** — agent/community interpretation.

---

## 19. Technical architecture

### 19.1 Stack

MVP baseline:

- **TypeScript** across game/domain/simulation/AI contracts.
- **React + Vite** game application.
- **Tauri** desktop shell.
- **pnpm workspace** monorepo.
- Local **Web Worker** for heavy simulation.
- **IndexedDB via Dexie** for Web persistence.
- **SQLite via Tauri SQL plugin** for desktop persistence.
- Thin **Hono + TypeScript AI Gateway** for online generative capabilities.

The game is local-first. Simulation never runs on the AI server.

### 19.2 Planned repository layout

```text
TCGTycoon/
├─ apps/
│  ├─ game/
│  │  └─ src/
│  │     ├─ app/
│  │     ├─ pages/
│  │     ├─ features/
│  │     │  ├─ dashboard/
│  │     │  ├─ cards/
│  │     │  ├─ expansions/
│  │     │  ├─ playtest/
│  │     │  ├─ meta/
│  │     │  ├─ market/
│  │     │  ├─ community/
│  │     │  ├─ tournaments/
│  │     │  ├─ operations/
│  │     │  ├─ daily-report/
│  │     │  └─ new-game/
│  │     ├─ components/
│  │     ├─ hooks/
│  │     ├─ services/
│  │     ├─ workers/
│  │     ├─ platform/
│  │     └─ styles/
│  ├─ desktop/
│  │  └─ src-tauri/
│  └─ api/
│     └─ src/
│        ├─ routes/
│        ├─ providers/
│        ├─ prompts/
│        ├─ schemas/
│        └─ middleware/
├─ packages/
│  ├─ domain/
│  ├─ rules-engine/
│  ├─ sim-core/
│  ├─ balance/
│  ├─ persistence/
│  ├─ ai-contracts/
│  └─ testkit/
├─ docs/
│  ├─ superpowers/specs/
│  ├─ architecture/
│  ├─ gameplay/
│  └─ codex/
├─ scripts/
└─ tests/
   ├─ integration/
   ├─ e2e/
   ├─ performance/
   └─ golden/
```

### 19.3 Domain package

`packages/domain` defines entities/value objects only. It does not run simulation logic.

Examples:

- CardDefinition.
- Printing.
- Expansion.
- ProductSKU / PrintRun.
- PersistentPlayer / NamedAgent.
- Deck / DeckGenome.
- Tournament.
- Market state/transaction.
- WorldEvent.
- WorldMetrics.
- DailyReport.

### 19.4 Rules Engine

`packages/rules-engine` is a pure local module concerned only with a single TCG match and related DSL validation/Battle AI.

Primary contract:

```ts
simulateMatch(input: MatchInput): MatchResult
```

It must not know about Cash, Hype, product sales, collectors, marketing or LLMs.

### 19.5 Simulation Core

`packages/sim-core` owns the live world day.

Primary contract:

```ts
simulateDay(
  state: WorldState,
  commands: PublisherCommand[],
  config: BalanceConfig
): DaySimulationResult
```

Output includes next state, report, notable structured events and optional post-commit AI enrichment requests.

### 19.6 Publisher commands

React UI cannot mutate WorldState directly. Publisher operations become validated commands such as:

- CreateExpansion.
- StartPlaytest.
- FinalizeExpansion.
- SchedulePrintRun.
- ScheduleTournament.
- StartCampaign.
- ScheduleBan/Restriction.
- AdjustMsrp.
- PublishAnnouncement.

### 19.7 Worker boundary

Heavy daily simulation runs outside the React main thread.

Worker protocol includes:

- `SIMULATE_DAY_REQUEST`
- `SIMULATE_DAY_PROGRESS`
- `SIMULATE_DAY_RESULT`
- `SIMULATE_DAY_ERROR`

MVP begins with one Simulation Worker and a replaceable MatchExecutor abstraction. A worker pool is an optimization only if benchmarks justify it.

---

## 20. World state and persistence

### 20.1 Normalized WorldState

Canonical world entities are normalized by ID, e.g. maps/records for cards, printings, expansions, products, players, agents, decks, tournaments and operations.

Avoid deeply nested duplicated objects.

### 20.2 Canonical vs derived vs cache

- **Canonical:** collections, ownership, inventory, prices, cash, players, projects, history.
- **Derived:** deck cost, accessibility summaries, UI projections.
- **Cache:** matchup simulation samples and other rebuildable performance data.

Derived/cache data must not be duplicated unnecessarily inside canonical saves.

### 20.3 Matchup cache

Cache key must include deck hashes and relevant rules/policy versions, not only Deck IDs.

Persist/retain enough aggregated samples to avoid recomputing established matchups every day.

### 20.4 Historical storage

Do not persist all casual match logs indefinitely.

Persist:

- Daily/period aggregates.
- Important historical events.
- Tournament matches/results.
- Playtest anomalies.
- Infinite-loop candidates.
- Important Named Agent matches.

### 20.5 Replay durability

Important replays store:

- Seed.
- RuleVersion.
- BattleAIVersion.
- Deck snapshots/hashes.
- Compact Action Log.

Playback uses the saved Action Log as the durable representation. Seed supports verification/debugging even if later Battle AI changes.

### 20.6 Save envelope

Every save includes:

```ts
SaveEnvelope {
  saveId
  schemaVersion
  simulationVersion
  ruleVersion
  balanceVersion
  appVersion
  worldSeed
  createdAt
  updatedAt
  state
}
```

### 20.7 Save migrations

Every persisted-schema change requires an explicit sequential migration to latest schema. Long-running sandbox saves are a core product asset and must not be treated as disposable.

### 20.8 Platform storage abstraction

Shared game code depends on a `SaveRepository` contract, not Dexie/SQLite directly.

Web adapter: IndexedDB/Dexie.  
Desktop adapter: SQLite/Tauri.

### 20.9 Atomic End Day

Required sequence:

`simulate -> validate invariants -> build report -> atomically persist next save -> replace UI state`

If simulation validation or save fails, the current day remains unchanged.

No mid-tick saves are allowed.

Autosave keeps at least current and previous daily snapshots to provide one-day rollback protection.

---

## 21. Determinism

### 21.1 RNG

Simulation code must never use `Math.random()`.

All randomness comes from a versioned deterministic RNG derived from stable inputs such as:

- WorldSeed.
- Day.
- Entity ID.
- Action type.
- Sequence/sub-seed.

### 21.2 Stable ordering

Simulation results must not rely on incidental object/map iteration order. Entities are processed in explicit stable order.

Independent match jobs derive their own seeds so future parallelization cannot change match results.

### 21.3 Versions

Persist/record at least:

- `SIMULATION_VERSION`
- `RULE_VERSION`
- `BATTLE_AI_VERSION`
- `BALANCE_VERSION`
- save `schemaVersion`

Same save + same pending publisher commands + same versions must produce the same next deterministic world-state hash.

---

## 22. Online AI Gateway

### 22.1 Boundary

Simulation Worker/Core contains no HTTP calls, LLM SDKs, prompts or image APIs.

The thin online gateway handles generative assistance only.

### 22.2 MVP endpoints/capabilities

Conceptual API:

- `POST /v1/world/assist`
- `POST /v1/cards/propose`
- `POST /v1/sets/complete`
- `POST /v1/community/render`
- `POST /v1/art/generate`

### 22.3 AI contracts

All AI responses must pass schema validation and domain validation before reaching the client/domain.

Provider-specific SDK calls are hidden behind a GenerativeProvider abstraction.

### 22.4 Mock AI

Development and automated testing require `AI_MODE=mock` or equivalent. A MockGenerativeProvider returns deterministic legal fixtures without network/API costs.

### 22.5 Failure degradation

- Card AI unavailable -> structured Card Editor remains usable.
- Artwork unavailable -> faction placeholder art.
- Community rendering unavailable -> deterministic template prose based on the same CommunityPostIntent.

AI failure must never prevent End Day.

### 22.6 Assets

Generated art is stored as platform assets referenced by Asset IDs. Binary image data is not embedded directly inside canonical WorldState JSON.

---

## 23. World invariants and error handling

At every daily commit, `validateWorldInvariants()` verifies at least:

- No negative card quantities.
- No negative Publisher Inventory.
- Valid player/cohort ownership.
- Constructed deck size = 20.
- Deck faction legality.
- All referenced IDs exist.
- No duplicate entity IDs.
- Cash/metrics/prices are finite.
- Prices are non-negative.
- Day increments exactly once.

Error classes:

- Recoverable UI error: isolate component/page.
- AI error: degrade presentation only.
- Simulation validation error: do not commit next state; preserve diagnostic snapshot.
- Save failure: do not replace current in-memory canonical day.

Development debug mode should emit per-phase hashes/traces to identify the first phase that corrupts state.

---

## 24. Testing and simulation tooling

### 24.1 Rules unit tests

Cover all core rules/keywords and edge cases including:

- Taunt.
- Charge/Rush.
- Deathrattle.
- Divine Shield + Poisonous interaction.
- Lifesteal.
- Windfury.
- Stealth targeting.
- Fatigue.
- Trigger-chain ordering and limits.

### 24.2 Determinism tests

- Same match input repeated -> identical result hash.
- Same world + commands repeated -> identical next-state hash.

### 24.3 Headless simulator

Repository must support no-UI commands conceptually equivalent to:

```bash
pnpm sim --days 100
pnpm sim --days 1000 --seed 12345
```

### 24.4 Headless Publisher Bot

Test bot should perform basic rational operations such as replenishing near-empty products, creating expansions at reasonable cadence, playtesting and avoiding obviously arbitrary bans.

Run many seeds over 1000+ days to catch economic explosion, universal collapse and invalid-state accumulation.

### 24.5 Golden scenario fixtures

Required regression worlds/scenarios include at least:

- `balanced-world`
- `broken-combo-world`
- `scarce-rare-world`
- `collector-bubble-world`
- `death-spiral-world`
- `revival-world`

### 24.6 Cross-system acceptance scenarios

The implemented MVP must demonstrate:

1. **Natural Meta:** balanced card pool produces multiple stable deck families.
2. **Hidden combo:** brewer discovers a strong combination after some delay, not instant global knowledge.
3. **Expensive Tier 1:** strong deck has suppressed adoption because core cards are scarce/expensive.
4. **Streamer effect:** weak/average deck receives short-lived adoption boost from a high-influence agent.
5. **Tournament shock:** cold deck wins a Major, driving knowledge, demand and Meta adoption.
6. **Cohort split:** healthy competitive environment can coexist with poor Budget/New-player satisfaction because of cost.
7. **Strong-card scarcity:** card price and Booster demand rise while deck usage is constrained.
8. **Targeted reprint:** deck cost falls and usage rises while First Edition retains more value.
9. **Starter arbitrage:** valuable Starter contents cause demand/sell-through and increase single-card supply.
10. **Ban shock:** competitive demand falls while collector demand may remain.
11. **Overprint:** cash/inventory pressure rises and scarcity premium falls.
12. **Shortage:** short-term FOMO may rise while conversion/accessibility/trust deteriorate if prolonged.
13. **Pack-EV equilibrium:** unusually profitable packs are opened more, increasing single-card supply and reducing EV gap.
14. **Advertising cannot fix bad retention:** exposure rises but active-player growth fails if onboarding/Meta is poor.
15. **Negative scandal raises Hype:** Hype up, sentiment/Meta Health/Trust may move down independently.
16. **True Death Spiral:** sustained acquisition below churn produces natural ecosystem contraction.
17. **Revival:** better product + Meta + accessibility + promotion can move Death Spiral back toward stability without a scripted “+5000 players” event.
18. **Long run:** 1000–3000 simulated days do not produce NaN, negative inventory or corrupted references.

### 24.7 UI end-to-end flows

At least:

- New Game -> Launch -> Day 1.
- Daily Report -> Meta problem -> Deck -> Card -> Replay -> policy action.
- Community price complaint -> Card -> Market -> Product -> Reprint -> Operations Calendar.
- Expansion Concept -> AI Draft -> Set Review -> Playtest -> edit -> Finalize -> Print -> Release.
- Tournament scheduling -> registration -> real simulation -> winner -> Meta/market reaction.
- Dashboard -> decisions -> End Day -> Daily Report -> next day.

---

## 25. Performance model

Initial gameplay scale targets:

- 300–1000 Persistent Sim Players.
- 24 Named Agents.
- Macro Active Players may reach 100k+ through cohorts.
- Typical live day samples roughly 5k–15k matches.
- Playtest and major events may sample more.

Heavy work runs in a Worker and must not freeze the React UI. Avoid committing to arbitrary millisecond targets before benchmarking; instead track regressions using automated benchmarks for:

- 10k match runtime.
- `simulateDay` runtime.
- Save size.
- Load time.

Matchup cache and selective deep evaluation are primary performance tools before adding a worker pool.

---

## 26. Planned development documentation

After this specification is reviewed and approved, the implementation phase should create supporting documents such as:

```text
docs/
├─ superpowers/specs/
│  └─ 2026-08-11-tcgtycoon-mvp-design.md
├─ architecture/
│  ├─ overview.md
│  ├─ simulation-core.md
│  ├─ rules-engine.md
│  ├─ persistence.md
│  └─ ai-gateway.md
├─ gameplay/
│  ├─ core-rules.md
│  ├─ economy.md
│  ├─ ai-society.md
│  ├─ operations.md
│  └─ balance-model.md
└─ codex/
   ├─ DEVELOPMENT_GUIDE.md
   ├─ DOMAIN_GLOSSARY.md
   ├─ TESTING_GUIDE.md
   └─ IMPLEMENTATION_ORDER.md
```

The Superpowers design specification remains the authoritative product-level source. Supporting documents must not silently redefine it.

---

## 27. Codex implementation guardrails

The repository root `AGENTS.md` created during implementation must enforce at least these rules:

1. Simulation Core remains deterministic.
2. Never use `Math.random()` in simulation/runtime rules code.
3. React components never mutate WorldState directly.
4. TCG gameplay rules belong in `packages/rules-engine`.
5. World/day simulation belongs in `packages/sim-core`.
6. AI/LLM/network code never enters deterministic simulation runtime.
7. Every new Effect/Keyword behavior requires rules-engine tests.
8. Every persisted schema change requires a save migration.
9. Balance numbers live in BalanceConfig, not scattered magic numbers.
10. World changes are driven through PublisherCommand or defined simulation phases.
11. Determinism and scenario tests run before considering simulation work complete.
12. Never invent unsupported Card DSL semantics.
13. Important historical replays must remain playable after future Battle AI changes.
14. Existing user saves are treated as durable product data, not disposable development artifacts.

---

## 28. Implementation risk reduction / vertical slices

### Vertical Slice 1 — Simulation proof

Using a fixed legal 48-card fixture and representative world:

1. Create/load world.
2. Physical cards exist in collections.
3. AI builds legal decks.
4. Rules Engine runs real matches.
5. Meta aggregates form.
6. Players buy 5-card Boosters.
7. Opened cards enter physical supply.
8. Secondary market transfers cards.
9. End Day produces deterministic next state.
10. Save and reload preserves state.
11. Same state + commands reproduces result.

UI may be minimal. This slice removes the largest technical risk.

### Vertical Slice 2 — Publisher loop

Add:

- Expansion pipeline.
- Playtests.
- Finalize/printing/release.
- Reprint.
- Ban/Restrict/Rotation.
- Tournaments.
- Campaigns.
- Full cash/metric/death-state loop.

Goal: a local no-generative-AI game can be played from Day 1 through long-term operation or bankruptcy.

### Vertical Slice 3 — AI and presentation

Add:

- AI world/faction assistance.
- AI card proposals and set completion.
- Named-agent prose rendering.
- Key-card/product artwork generation.
- Complete polished information architecture.
- Tauri desktop packaging.

Generative AI enhances creation and narrative but is not required for simulation validity.

---

## 29. Final MVP success definition

The MVP is successful when a player can create a themed physical TCG, launch a real 48-card first set, watch a simulated community acquire cards and organically develop a Meta, respond to unexpected deck/economic/community outcomes, ship future expansions through a delayed production pipeline, and continue operating indefinitely until either the TCG collapses or the company becomes insolvent.

A successful run must be capable of producing unscripted stories such as:

> A harmless-looking Rare becomes the core of an undiscovered combo. A brewer finds it weeks after launch. A streamer and tournament win spread the deck. The core card becomes scarce, causing price spikes and limiting adoption. The publisher orders a large reprint, but before it arrives the Meta becomes unhealthy. Restricting the card could stabilize competitive play but may damage a product that is already in print and upset buyers. The decision then changes future sales, community trust, collector behavior and the relevance of the next expansion already being developed.

If the game can produce, explain and persist this chain through deterministic systems rather than scripted event modifiers, the core Publisher Simulation vision has been achieved.
