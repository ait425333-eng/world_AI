import type { ServerInsightStory, ServerInsights } from '@/services/insights-loader';
import type { ClusteredEvent } from '@/types';
import { evaluateScenarioLikelihood } from './scenario-probability';
import type { ProbableScenariosThreatIndicator } from '@/services/probable-scenarios-risk';

export const THREAT_LEVELS = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type TimelineThreatLevel = typeof THREAT_LEVELS[number];

export const THREAT_LEVEL_LABELS: Record<TimelineThreatLevel, string> = {
  critical: 'Highly Likely',
  high: 'Likely',
  medium: 'Possible',
  low: 'Unlikely',
  info: 'Highly Unlikely',
};

export const THREAT_LEVEL_COLORS: Record<TimelineThreatLevel, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#38bdf8',
  info: '#94a3b8',
};

/** Nine scenario domains shown on Probable Scenarios item chips. */
export const SCENARIO_DOMAINS = [
  'Pol',
  'Mil',
  'Dipl',
  'int/info',
  'Eco',
  'Health',
  'Cyber',
  'Tech',
  'Envmtl',
] as const;

export type ScenarioDomain = typeof SCENARIO_DOMAINS[number];

const CATEGORY_TO_DOMAIN: Record<string, ScenarioDomain> = {
  conflict: 'Mil',
  military: 'Mil',
  terrorism: 'Mil',
  protest: 'Pol',
  crime: 'Pol',
  diplomatic: 'Dipl',
  economic: 'Eco',
  health: 'Health',
  cyber: 'Cyber',
  tech: 'Tech',
  environmental: 'Envmtl',
  disaster: 'Envmtl',
  infrastructure: 'int/info',
  general: 'int/info',
};

const DOMAIN_THREAT_INDICATORS: Record<ScenarioDomain, string[]> = {
  Pol: ['CSS Mtg(s)', 'Ldrship succession uncertainty', 'Provocative statements'],
  Mil: ['Force posture shift', 'Strike activity', 'Mobilization signals'],
  Dipl: ['Ambassador recalls', 'Treaty violations', 'Travel advisories'],
  'int/info': ['Frenzy media campaigns', 'Coord bot activity', 'Attks on pub confd'],
  Eco: ['Water scty', 'Industrial decline', 'commodity shortages'],
  Health: ['Food insecurity/water shortages', 'Unexplained disease clusters', 'Eco-sys damaging tech'],
  Cyber: ['tgt of natl power grids', 'Credential theft', 'Cyber recce'],
  Tech: ['Cloud computing platforms', 'Autonomous wpns devs', 'Emerging tech IP thefts'],
  Envmtl: ['Food insecurity/water shortages', 'Unexplained disease clusters', 'Eco-sys damaging tech'],
};

export function scenarioDomainFromCategory(category: string | undefined): ScenarioDomain {
  const key = String(category ?? '').trim().toLowerCase();
  return CATEGORY_TO_DOMAIN[key] ?? 'int/info';
}

export function threatIndicatorsForDomain(domain: ScenarioDomain): string[] {
  return DOMAIN_THREAT_INDICATORS[domain];
}

const SEVERITY_RANK: Record<TimelineThreatLevel, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export interface ThreatTimelineItem {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  category: string;
  threatLevel: TimelineThreatLevel;
  /** Weighted likelihood score P(S) in 0–100. */
  probability: number;
  rawThreatLevel: string;
  timestampMs: number;
  isAlert: boolean;
  sourceCount: number;
  provenance: string;
}

export interface ThreatTimelineDay {
  key: string;
  label: string;
  startMs: number;
  counts: Record<TimelineThreatLevel, number>;
  total: number;
}

export interface ThreatTimelineGroup {
  level: TimelineThreatLevel;
  label: string;
  count: number;
  items: ThreatTimelineItem[];
}

export interface ThreatTimelineState {
  days: ThreatTimelineDay[];
  groups: ThreatTimelineGroup[];
  totals: Record<TimelineThreatLevel, number>;
  items: ThreatTimelineItem[];
  status: 'ok' | 'degraded';
  statusMessage: string;
  degradedReasons: string[];
  hasData: boolean;
}

export interface ThreatTimelineTrend {
  label: string;
  copy: string;
  className: string;
}

export function normalizeThreatLevel(value: unknown): TimelineThreatLevel {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'critical' || normalized === 'high' || normalized === 'medium' || normalized === 'low' || normalized === 'info') {
    return normalized;
  }
  if (normalized === 'elevated' || normalized === 'moderate') {
    return 'medium';
  }
  return 'info';
}

export function normalizeServerInsightStories(insights: Pick<ServerInsights, 'topStories' | 'generatedAt'>): ThreatTimelineItem[] {
  const generatedAtMs = parseTimestampMs(insights.generatedAt) ?? Date.now();
  return insights.topStories
    .map((story, index) => normalizeServerInsightStory(story, index, generatedAtMs))
    .filter((item): item is ThreatTimelineItem => item !== null);
}

export function normalizeClusterStories(clusters: ClusteredEvent[]): ThreatTimelineItem[] {
  return clusters
    .map((cluster, index) => normalizeClusterStory(cluster, index))
    .filter((item): item is ThreatTimelineItem => item !== null);
}

export function buildThreatTimelineState(
  inputItems: ThreatTimelineItem[],
  options: { nowMs?: number; status?: 'ok' | 'degraded'; statusMessage?: string } = {},
): ThreatTimelineState {
  const nowMs = options.nowMs ?? Date.now();
  const todayStart = utcDayStartMs(nowMs);
  const startMs = todayStart - (6 * DAY_MS);
  const endMs = todayStart + DAY_MS;
  const dayMap = new Map<string, ThreatTimelineDay>();
  const totals = emptyCounts();
  const degradedReasons: string[] = [];
  let invalidTimestampCount = 0;

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayStart = startMs + (dayIndex * DAY_MS);
    const key = dayKey(dayStart);
    dayMap.set(key, {
      key,
      label: dayLabel(dayStart),
      startMs: dayStart,
      counts: emptyCounts(),
      total: 0,
    });
  }

  const inWindowItems: ThreatTimelineItem[] = [];
  for (const item of inputItems) {
    if (!Number.isFinite(item.timestampMs)) {
      invalidTimestampCount++;
      continue;
    }
    if (item.timestampMs < startMs || item.timestampMs >= endMs) {
      continue;
    }
    const key = dayKey(item.timestampMs);
    const day = dayMap.get(key);
    if (!day) continue;
    day.counts[item.threatLevel] += 1;
    day.total += 1;
    totals[item.threatLevel] += 1;
    inWindowItems.push(item);
  }

  if (invalidTimestampCount > 0) {
    degradedReasons.push(`${invalidTimestampCount} item(s) missing a valid timestamp`);
  }
  if (options.status === 'degraded' && options.statusMessage) {
    degradedReasons.push(options.statusMessage);
  }

  const sortedItems = [...inWindowItems].sort(compareThreatTimelineItems);
  const groups = THREAT_LEVELS
    .map((level) => ({
      level,
      label: THREAT_LEVEL_LABELS[level],
      count: totals[level],
      items: sortedItems.filter((item) => item.threatLevel === level).slice(0, 5),
    }))
    .filter((group) => group.count > 0);

  return {
    days: [...dayMap.values()],
    groups,
    totals,
    items: sortedItems,
    status: options.status ?? 'ok',
    statusMessage: options.statusMessage ?? '',
    degradedReasons,
    hasData: sortedItems.length > 0,
  };
}

export function countHighSeverityDays(state: ThreatTimelineState): number {
  return state.days.filter((day) => day.counts.critical + day.counts.high > 0).length;
}

export function describeThreatTimelineTrend(days: ThreatTimelineDay[]): ThreatTimelineTrend {
  const firstThree = days.slice(0, 3).reduce((sum, day) => sum + day.counts.critical + day.counts.high, 0);
  const lastThree = days.slice(-3).reduce((sum, day) => sum + day.counts.critical + day.counts.high, 0);
  if (lastThree === 0 && firstThree === 0) {
    return { label: 'Quiet', copy: 'No highly likely/likely days', className: 'quiet' };
  }
  if (lastThree >= firstThree + 2) {
    return { label: 'Worsening', copy: `${lastThree} recent vs ${firstThree} earlier`, className: 'worsening' };
  }
  if (firstThree >= lastThree + 2) {
    return { label: 'Easing', copy: `${lastThree} recent vs ${firstThree} earlier`, className: 'easing' };
  }
  return { label: 'Noisy', copy: `${lastThree} recent vs ${firstThree} earlier`, className: 'noisy' };
}

const LEVEL_WEIGHT: Record<TimelineThreatLevel, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

const PRIORITY_DOMAINS = new Set(['Mil', 'Cyber', 'Dipl', 'Pol']);

export interface ProbableScenariosRiskFields {
  compositeScore: number;
  trend: 'escalating' | 'stable' | 'de-escalating';
  topRisks: string[];
  topThreatIndicators: ProbableScenariosThreatIndicator[];
  elevatedCount: number;
  possibleCount: number;
  activeDomains: number;
  totalItems: number;
  status: ThreatTimelineState['status'];
  degraded: boolean;
  timestamp: Date;
}

/** Derive Strategic Risk Overview inputs from Probable Scenarios state. */
export function summarizeProbableScenariosRisk(state: ThreatTimelineState): ProbableScenariosRiskFields {
  const totals = state.totals;
  const totalItems = Math.max(1, state.items.length);
  // Prefer mean P(S) when scenarios carry scored probabilities.
  const scored = state.items.filter((item) => Number.isFinite(item.probability));
  const meanProbability = scored.length > 0
    ? scored.reduce((sum, item) => sum + item.probability, 0) / scored.length
    : null;
  const weightedSum =
    totals.critical * LEVEL_WEIGHT.critical +
    totals.high * LEVEL_WEIGHT.high +
    totals.medium * LEVEL_WEIGHT.medium +
    totals.low * LEVEL_WEIGHT.low +
    totals.info * LEVEL_WEIGHT.info;
  const intensity = (weightedSum / totalItems) / 5;
  const elevatedBoost = totals.critical * 8 + totals.high * 4;
  const priorityDomainBoost = countPriorityDomainHits(state.items) * 2;
  const portfolioScore = Math.max(
    0,
    Math.min(100, Math.round(intensity * 100 + elevatedBoost * 0.35 + priorityDomainBoost)),
  );
  // Blend mean P(S) with elevated-scenario portfolio pressure so a few Likely
  // items still lift Strategic Risk above a sea of Highly Unlikely noise.
  const compositeScore = meanProbability == null
    ? portfolioScore
    : Math.max(
      0,
      Math.min(100, Math.round(meanProbability * 0.65 + portfolioScore * 0.35)),
    );

  const timelineTrend = describeThreatTimelineTrend(state.days);
  const trend: ProbableScenariosRiskFields['trend'] =
    timelineTrend.label === 'Worsening'
      ? 'escalating'
      : timelineTrend.label === 'Easing'
        ? 'de-escalating'
        : 'stable';

  const topThreatIndicators = buildTopThreatIndicators(state.items);

  return {
    compositeScore,
    trend,
    topRisks: buildScenarioTopRisks(state.items),
    topThreatIndicators,
    elevatedCount: totals.critical + totals.high,
    possibleCount: totals.medium,
    activeDomains: countActiveScenarioDomains(state.items),
    totalItems: state.items.length,
    status: state.status,
    degraded: state.status === 'degraded' || state.degradedReasons.length > 0,
    timestamp: new Date(),
  };
}

function countPriorityDomainHits(items: ThreatTimelineItem[]): number {
  let hits = 0;
  for (const item of items) {
    if (item.threatLevel !== 'critical' && item.threatLevel !== 'high') continue;
    if (PRIORITY_DOMAINS.has(scenarioDomainFromCategory(item.category))) hits += 1;
  }
  return Math.min(12, hits);
}

function countActiveScenarioDomains(items: ThreatTimelineItem[]): number {
  return new Set(items.map((item) => scenarioDomainFromCategory(item.category))).size;
}

function selectTopScenarioItems(items: ThreatTimelineItem[]): ThreatTimelineItem[] {
  const elevated = items.filter(
    (item) => item.threatLevel === 'critical' || item.threatLevel === 'high',
  );
  const pool = elevated.length > 0 ? elevated : items;
  return [...pool]
    .sort((a, b) =>
      SEVERITY_RANK[b.threatLevel] - SEVERITY_RANK[a.threatLevel]
      || b.probability - a.probability
      || b.timestampMs - a.timestampMs,
    )
    .slice(0, 5);
}

function buildTopThreatIndicators(items: ThreatTimelineItem[]): ProbableScenariosThreatIndicator[] {
  return selectTopScenarioItems(items).map((item) => {
    const domain = scenarioDomainFromCategory(item.category);
    return {
      id: item.id,
      title: item.title,
      domain,
      level: item.threatLevel,
      levelLabel: THREAT_LEVEL_LABELS[item.threatLevel],
      probability: item.probability,
      indicators: threatIndicatorsForDomain(domain),
      timestampMs: item.timestampMs,
      sourceUrl: item.sourceUrl || undefined,
    };
  });
}

function buildScenarioTopRisks(items: ThreatTimelineItem[]): string[] {
  const selected = selectTopScenarioItems(items);
  if (selected.length > 0) {
    return selected.map((item) => {
      const domain = scenarioDomainFromCategory(item.category);
      const title = item.title.length > 72 ? `${item.title.slice(0, 69)}...` : item.title;
      return `${domain}: ${title} (${item.probability.toFixed(1)}%)`;
    });
  }

  const counts = new Map<string, number>();
  for (const item of items) {
    const domain = scenarioDomainFromCategory(item.category);
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain, count]) => `${domain}: ${count} scenarios`);
}

export function compareThreatTimelineItems(a: ThreatTimelineItem, b: ThreatTimelineItem): number {
  const severityDelta = SEVERITY_RANK[b.threatLevel] - SEVERITY_RANK[a.threatLevel];
  if (severityDelta !== 0) return severityDelta;
  const probabilityDelta = b.probability - a.probability;
  if (probabilityDelta !== 0) return probabilityDelta;
  const timeDelta = b.timestampMs - a.timestampMs;
  if (timeDelta !== 0) return timeDelta;
  return b.sourceCount - a.sourceCount;
}

function normalizeServerInsightStory(story: ServerInsightStory, index: number, fallbackTimestampMs: number): ThreatTimelineItem | null {
  const timestampMs = parseTimestampMs(story.pubDate) ?? fallbackTimestampMs;
  const source = cleanSource(story.primarySource) || 'News Digest';
  const rawThreatLevel = String(story.threatLevel ?? '');
  const category = story.category || 'general';
  const sourceCount = Number.isFinite(story.uniqueSourceCount) ? story.uniqueSourceCount! : 1;
  const likelihood = evaluateScenarioLikelihood({
    category,
    importanceScore: story.importanceScore,
    credibilityScore: story.credibilityScore,
    sourceCount,
    isAlert: Boolean(story.isAlert),
    velocityLevel: story.velocity?.level,
    velocitySourcesPerHour: story.velocity?.sourcesPerHour,
    rawThreatLevel,
  });
  return {
    id: `server-${index}-${stableSlug(story.primaryTitle)}`,
    title: story.primaryTitle || 'Untitled intelligence item',
    source,
    sourceUrl: story.primaryLink || '',
    category,
    threatLevel: likelihood.category,
    probability: likelihood.probability,
    rawThreatLevel,
    timestampMs,
    isAlert: Boolean(story.isAlert),
    // #6428: the timeline renders "N sources", a corroboration claim, so it
    // counts PUBLISHERS. story.sourceCount is the article count. Fail closed
    // to 1 (renders nothing) on a payload predating the publisher count.
    sourceCount,
    provenance: inferProvenance(source),
  };
}

function normalizeClusterStory(cluster: ClusteredEvent, index: number): ThreatTimelineItem | null {
  const timestampMs = parseTimestampMs(cluster.lastUpdated) ?? parseTimestampMs(cluster.firstSeen);
  if (timestampMs === null) return null;
  const topSource = cluster.topSources[0];
  const source = cleanSource(topSource?.name || cluster.primarySource) || 'News Digest';
  const rawThreatLevel = String(cluster.threat?.level ?? 'info');
  const category = cluster.threat?.category || 'general';
  const sourceCount = Number.isFinite(cluster.uniquePublisherCount) ? cluster.uniquePublisherCount : 1;
  const likelihood = evaluateScenarioLikelihood({
    category,
    credibilityScore: cluster.credibilityScore,
    sourceCount,
    isAlert: Boolean(cluster.isAlert),
    velocityLevel: cluster.velocity?.level,
    velocitySourcesPerHour: cluster.velocity?.sourcesPerHour,
    rawThreatLevel,
    confidence: cluster.threat?.confidence,
  });
  return {
    id: cluster.id || `cluster-${index}-${stableSlug(cluster.primaryTitle)}`,
    title: cluster.primaryTitle || 'Untitled intelligence item',
    source,
    sourceUrl: topSource?.url || cluster.primaryLink || '',
    category,
    threatLevel: likelihood.category,
    probability: likelihood.probability,
    rawThreatLevel,
    timestampMs,
    isAlert: Boolean(cluster.isAlert),
    sourceCount,
    provenance: inferProvenance(source, cluster.threat?.source),
  };
}

function inferProvenance(source: string, threatSource?: string): string {
  const normalizedThreatSource = String(threatSource ?? '').trim().toLowerCase();
  if (normalizedThreatSource === 'keyword') return 'Keyword fallback';
  const normalizedSource = source.toLowerCase();
  if (normalizedSource.includes('acled')) return 'ACLED';
  if (normalizedSource.includes('news digest')) return 'News Digest';
  return source || 'News Digest';
}

function cleanSource(source: string | undefined): string {
  return String(source ?? '').replace(/\s+/g, ' ').trim();
}

function emptyCounts(): Record<TimelineThreatLevel, number> {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
}

function parseTimestampMs(value: Date | string | number | undefined): number | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function utcDayStartMs(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function dayKey(ms: number): string {
  return new Date(utcDayStartMs(ms)).toISOString().slice(0, 10);
}

function dayLabel(ms: number): string {
  const date = new Date(ms);
  const month = MONTHS[date.getUTCMonth()] ?? 'Jan';
  return `${month} ${date.getUTCDate()}`;
}

function stableSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
}
