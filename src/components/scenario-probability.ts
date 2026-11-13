/**
 * Predictive Strategic Analysis — weighted scenario likelihood.
 * P(S) = Σ(w_i × x_i) / Σ(w_i) × 100
 *
 * This is a weighted likelihood score, not a calibrated statistical probability.
 */

/** Matches ThreatTimelinePanel lanes: critical→Highly Likely … info→Highly Unlikely. */
export type ScenarioProbabilityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export const SCENARIO_INDICATORS = [
  { id: 'military', label: 'Military mobilization', weight: 0.30 },
  { id: 'diplomatic', label: 'Diplomatic tensions', weight: 0.20 },
  { id: 'political', label: 'Political instability', weight: 0.20 },
  { id: 'economic', label: 'Economic pressure', weight: 0.15 },
  { id: 'intelligence', label: 'Intelligence warnings', weight: 0.15 },
] as const;

export type ScenarioIndicatorId = typeof SCENARIO_INDICATORS[number]['id'];

export const SCENARIO_INDICATOR_WEIGHTS: number[] = SCENARIO_INDICATORS.map((i) => i.weight);

/** Five-level classification thresholds for C(P). */
export const SCENARIO_PROBABILITY_BANDS = [
  { min: 80, level: 'critical' as const, label: 'Highly Likely' },
  { min: 65, level: 'high' as const, label: 'Likely' },
  { min: 50, level: 'medium' as const, label: 'Possible' },
  { min: 25, level: 'low' as const, label: 'Unlikely' },
  { min: 0, level: 'info' as const, label: 'Highly Unlikely' },
] as const;

export interface ScenarioProbabilityResult {
  probability: number;
  category: ScenarioProbabilityLevel;
  label: string;
}

export interface ScenarioIndicatorScores {
  scores: number[];
  weights: number[];
}

export interface ScenarioLikelihoodInput {
  category?: string;
  importanceScore?: number;
  credibilityScore?: number;
  sourceCount?: number;
  isAlert?: boolean;
  velocityLevel?: string;
  velocitySourcesPerHour?: number;
  /** Upstream severity string — used as a soft prior, not the final class. */
  rawThreatLevel?: string;
  /** Cluster ML/LLM confidence in [0, 1] when available. */
  confidence?: number;
}

/** Band midpoints used as soft priors when upstream threatLevel is present. */
const THREAT_PRIOR: Record<string, number> = {
  critical: 0.92,
  high: 0.78,
  medium: 0.62,
  elevated: 0.62,
  moderate: 0.62,
  low: 0.40,
  info: 0.12,
};

/** Domain affinity toward the five strategic indicators [mil, dipl, pol, eco, intel]. */
const CATEGORY_AFFINITY: Record<string, number[]> = {
  conflict: [1.0, 0.35, 0.25, 0.15, 0.45],
  military: [1.0, 0.30, 0.20, 0.10, 0.40],
  terrorism: [0.85, 0.25, 0.35, 0.10, 0.55],
  protest: [0.25, 0.20, 1.0, 0.25, 0.30],
  crime: [0.20, 0.10, 0.75, 0.15, 0.35],
  diplomatic: [0.25, 1.0, 0.45, 0.20, 0.35],
  economic: [0.10, 0.20, 0.30, 1.0, 0.25],
  health: [0.05, 0.15, 0.35, 0.40, 0.45],
  cyber: [0.35, 0.15, 0.20, 0.25, 1.0],
  tech: [0.15, 0.10, 0.15, 0.35, 0.70],
  environmental: [0.10, 0.15, 0.25, 0.45, 0.40],
  disaster: [0.15, 0.20, 0.30, 0.40, 0.45],
  infrastructure: [0.25, 0.15, 0.25, 0.45, 0.55],
  general: [0.35, 0.35, 0.35, 0.35, 0.45],
};

/**
 * Weighted likelihood score:
 * P(S) = Σ(w_i × x_i) / Σ(w_i) × 100
 */
export function calculateScenarioProbability(
  scores: number[],
  weights: number[] = SCENARIO_INDICATOR_WEIGHTS,
): number {
  if (scores.length === 0 || weights.length === 0) return 0;
  const n = Math.min(scores.length, weights.length);
  let weighted = 0;
  let weightSum = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.max(0, weights[i] ?? 0);
    const x = clamp01(scores[i] ?? 0);
    weighted += w * x;
    weightSum += w;
  }
  if (weightSum <= 0) return 0;
  return round2((weighted / weightSum) * 100);
}

/** C(P) five-level classification including Highly Unlikely. */
export function classifyScenarioProbability(probability: number): ScenarioProbabilityResult {
  const p = Number.isFinite(probability) ? Math.max(0, Math.min(100, probability)) : 0;
  const band = SCENARIO_PROBABILITY_BANDS.find((entry) => p >= entry.min) ?? SCENARIO_PROBABILITY_BANDS[SCENARIO_PROBABILITY_BANDS.length - 1]!;
  return {
    probability: round2(p),
    category: band.level,
    label: band.label,
  };
}

export function calculateAndClassifyScenarioProbability(
  scores: number[],
  weights: number[] = SCENARIO_INDICATOR_WEIGHTS,
): ScenarioProbabilityResult {
  return classifyScenarioProbability(calculateScenarioProbability(scores, weights));
}

/** Build normalized indicator scores (x_i ∈ [0,1]) from story/cluster signals. */
export function scoreScenarioIndicators(input: ScenarioLikelihoodInput): ScenarioIndicatorScores {
  const prior = priorFromThreatLevel(input.rawThreatLevel);
  const signal = baseSignal(input);
  // Upstream severity is a soft prior so C(P) stays near the reported band;
  // domain affinity applies a light tilt so military/diplomatic/etc. still matter.
  const intensity = clamp01(0.78 * prior + 0.22 * signal);
  const affinity = affinityForCategory(input.category);

  const scores = affinity.map((a) => clamp01(intensity * (0.92 + 0.08 * a)));
  return { scores, weights: [...SCENARIO_INDICATOR_WEIGHTS] };
}

/** Full evaluate path: indicators → P(S) → C(P). */
export function evaluateScenarioLikelihood(input: ScenarioLikelihoodInput): ScenarioProbabilityResult & {
  scores: number[];
  weights: number[];
} {
  const { scores, weights } = scoreScenarioIndicators(input);
  const result = calculateAndClassifyScenarioProbability(scores, weights);
  return { ...result, scores, weights };
}

function priorFromThreatLevel(raw: string | undefined): number {
  const key = String(raw ?? '').trim().toLowerCase();
  return THREAT_PRIOR[key] ?? 0.125;
}

function affinityForCategory(category: string | undefined): number[] {
  const key = String(category ?? '').trim().toLowerCase();
  return CATEGORY_AFFINITY[key] ?? CATEGORY_AFFINITY.general!;
}

function baseSignal(input: ScenarioLikelihoodInput): number {
  const importance = clamp01((Number(input.importanceScore) || 0) / 100);
  const credibility = input.credibilityScore == null
    ? 0.4
    : clamp01((Number(input.credibilityScore) || 0) / 100);
  const sources = clamp01((Math.max(1, Number(input.sourceCount) || 1) - 1) / 4);
  const alertBoost = input.isAlert ? 0.18 : 0;
  const velocity = velocityBoost(input.velocityLevel, input.velocitySourcesPerHour);
  const confidence = input.confidence == null ? 0 : clamp01(Number(input.confidence) || 0) * 0.15;

  return clamp01(
    importance * 0.35 +
    credibility * 0.15 +
    sources * 0.20 +
    velocity * 0.12 +
    alertBoost +
    confidence,
  );
}

function velocityBoost(level: string | undefined, sourcesPerHour: number | undefined): number {
  const normalized = String(level ?? '').trim().toLowerCase();
  if (normalized === 'spike') return 1;
  if (normalized === 'elevated') return 0.65;
  if (Number.isFinite(sourcesPerHour) && (sourcesPerHour as number) >= 3) return 0.8;
  if (Number.isFinite(sourcesPerHour) && (sourcesPerHour as number) >= 1.5) return 0.45;
  return 0.15;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
