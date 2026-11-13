export const PROBABLE_SCENARIOS_UPDATED_EVENT = 'wm:probable-scenarios-updated';

export interface ProbableScenariosThreatIndicator {
  id: string;
  title: string;
  domain: string;
  level: 'critical' | 'high' | 'medium' | 'low' | 'info';
  levelLabel: string;
  probability: number;
  indicators: string[];
  timestampMs: number;
  sourceUrl?: string;
}

export interface ProbableScenariosRiskSummary {
  compositeScore: number;
  trend: 'escalating' | 'stable' | 'de-escalating';
  topRisks: string[];
  /** Latest elevated scenarios for Indicators picker (max 5). */
  topThreatIndicators: ProbableScenariosThreatIndicator[];
  elevatedCount: number;
  possibleCount: number;
  activeDomains: number;
  totalItems: number;
  status: 'ok' | 'degraded';
  degraded: boolean;
  timestamp: Date;
}

let latestSummary: ProbableScenariosRiskSummary | null = null;

export function setProbableScenariosRiskSummary(summary: ProbableScenariosRiskSummary | null): void {
  latestSummary = summary;
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent(PROBABLE_SCENARIOS_UPDATED_EVENT));
  }
}

export function getProbableScenariosRiskSummary(): ProbableScenariosRiskSummary | null {
  return latestSummary;
}

/** Latest elevated Probable Scenarios items for the Indicators picker. */
export function getLatestThreatIndicators(limit = 5): ProbableScenariosThreatIndicator[] {
  const items = latestSummary?.topThreatIndicators ?? [];
  return items.slice(0, Math.max(0, limit));
}

/** Test helper — clear shared state between suite runs. */
export function __resetProbableScenariosRiskForTests(): void {
  latestSummary = null;
}
