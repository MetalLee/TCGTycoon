import { METRICS_CONFIG } from "@tcgtycoon/balance";

export type EcosystemRiskState =
  "STABLE" | "STRAINED" | "DECLINING" | "DEATH_SPIRAL" | "TERMINAL";

export type EcosystemRiskInput = {
  activePlayers: number;
  hype: number;
  brandTrust: number;
  acquisitionToChurnRatio: number;
  retentionRate: number;
  activePlayerTrend: number;
  consecutiveDeclineDays: number;
  consecutiveLowActivityDays: number;
  cash: number;
};

export function evaluateEcosystemRisk(
  input: EcosystemRiskInput,
): EcosystemRiskState {
  const config = METRICS_CONFIG.ecosystemRisk;
  const ecosystemDead =
    input.activePlayers < config.terminalActivePlayers &&
    input.hype < config.terminalHype &&
    input.consecutiveLowActivityDays >= config.terminalPersistenceDays;
  if (input.cash < config.emergencyCreditLimit || ecosystemDead) {
    return "TERMINAL";
  }

  const negativeSignals = [
    input.acquisitionToChurnRatio < config.weakAcquisitionToChurnRatio,
    input.retentionRate < config.weakRetentionRate,
    input.hype < config.lowHype,
    input.brandTrust < config.lowBrandTrust,
    input.activePlayerTrend <= config.decliningActivePlayerTrend,
    input.consecutiveDeclineDays >= config.minimumDeclineDaysForDeathSpiral,
  ].filter(Boolean).length;

  if (
    negativeSignals >= config.deathSpiralMinimumSignals &&
    input.consecutiveDeclineDays >= config.minimumDeclineDaysForDeathSpiral
  ) {
    return "DEATH_SPIRAL";
  }
  if (negativeSignals >= config.decliningMinimumSignals) {
    return "DECLINING";
  }
  if (negativeSignals >= config.strainedMinimumSignals) {
    return "STRAINED";
  }
  return "STABLE";
}
