import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  __resetProbableScenariosRiskForTests,
  getLatestThreatIndicators,
  setProbableScenariosRiskSummary,
} from '../src/services/probable-scenarios-risk.ts';

describe('latest threat indicators', () => {
  it('returns at most five elevated Probable Scenarios items for the Indicators picker', () => {
    __resetProbableScenariosRiskForTests();
    setProbableScenariosRiskSummary({
      compositeScore: 55,
      trend: 'escalating',
      topRisks: [],
      topThreatIndicators: Array.from({ length: 7 }, (_, index) => ({
        id: `item-${index}`,
        title: `Scenario ${index}`,
        domain: 'Mil',
        level: 'high',
        levelLabel: 'Likely',
        probability: 70 - index,
        indicators: ['Force posture shift'],
        timestampMs: Date.now() - index * 1000,
      })),
      elevatedCount: 7,
      possibleCount: 0,
      activeDomains: 1,
      totalItems: 7,
      status: 'ok',
      degraded: false,
      timestamp: new Date(),
    });

    const latest = getLatestThreatIndicators(5);
    assert.equal(latest.length, 5);
    assert.equal(latest[0]?.title, 'Scenario 0');
    assert.equal(latest[4]?.title, 'Scenario 4');
    __resetProbableScenariosRiskForTests();
  });
});
