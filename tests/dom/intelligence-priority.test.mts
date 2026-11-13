import { beforeAll, afterEach, expect, it, vi } from 'vitest';
import { IntelligenceGapBadge } from '@/components/IntelligenceGapBadge';
import {
  setProbableScenariosRiskSummary,
  __resetProbableScenariosRiskForTests,
} from '@/services/probable-scenarios-risk';
import { initTestI18n } from './helpers/i18n.mts';

beforeAll(initTestI18n);

afterEach(() => {
  __resetProbableScenariosRiskForTests();
});

it('does not mark a low threat-indicator total as high priority', async () => {
  setProbableScenariosRiskSummary({
    compositeScore: 20,
    trend: 'stable',
    topRisks: [],
    topThreatIndicators: [],
    elevatedCount: 0,
    possibleCount: 1,
    activeDomains: 1,
    totalItems: 1,
    status: 'ok',
    degraded: false,
    timestamp: new Date(),
  });

  const methods = IntelligenceGapBadge.prototype as unknown as {
    update(): Promise<void>; priorityToConfidence(priority: string): number;
  };
  const badge = document.createElement('div');
  const confidence = methods.priorityToConfidence('low');
  const host = { updateEpoch: 0, enabled: true, destroyed: false, badge,
    lastFindingCount: 0, renderDropdown: vi.fn(),
    mergeFindings: async () => [{ priority: 'low', confidence }],
  };
  await methods.update.call(host);
  expect(badge.classList.contains('status-high')).toBe(false);
  expect(badge.classList.contains('status-low')).toBe(true);
  expect(confidence).toBe(0.4);
});

it('shows total threat indicators count on the badge', async () => {
  setProbableScenariosRiskSummary({
    compositeScore: 55,
    trend: 'escalating',
    topRisks: ['A'],
    topThreatIndicators: [],
    elevatedCount: 2,
    possibleCount: 3,
    activeDomains: 2,
    totalItems: 7,
    status: 'ok',
    degraded: false,
    timestamp: new Date(),
  });

  const methods = IntelligenceGapBadge.prototype as unknown as {
    update(): Promise<void>;
  };
  const badge = document.createElement('button');
  badge.innerHTML = '<span class="findings-count">0</span>';
  const host = {
    updateEpoch: 0,
    enabled: true,
    destroyed: false,
    badge,
    lastFindingCount: 0,
    renderDropdown: vi.fn(),
    mergeFindings: async () => [],
  };
  await methods.update.call(host);
  expect(badge.querySelector('.findings-count')?.textContent).toBe('7');
  expect(badge.classList.contains('status-high')).toBe(true);
});
