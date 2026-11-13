import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPanelSearchAliases,
  normalizePanelSearchText,
  panelMatchesSearchQuery,
} from '../src/services/panel-search.ts';

describe('panel search', () => {
  it('normalizes hyphens and extra spaces', () => {
    assert.equal(normalizePanelSearchText('Threat-Timeline'), 'threat timeline');
    assert.equal(normalizePanelSearchText('  probable   scenarios '), 'probable scenarios');
  });

  it('exposes Probable Scenarios aliases including legacy Threat Timeline terms', () => {
    const aliases = getPanelSearchAliases('threat-timeline');
    assert.ok(aliases.includes('probable scenarios'));
    assert.ok(aliases.includes('threat timeline'));
    assert.ok(aliases.includes('probability levels'));
  });

  it('matches Probable Scenarios by new name, old name, and spaced timeline queries', () => {
    const key = 'threat-timeline';
    const name = 'Probable Scenarios';
    const localized = 'Probable Scenarios';

    assert.equal(panelMatchesSearchQuery(key, name, localized, 'probable scenarios'), true);
    assert.equal(panelMatchesSearchQuery(key, name, localized, 'probable'), true);
    assert.equal(panelMatchesSearchQuery(key, name, localized, 'scenarios'), true);
    assert.equal(panelMatchesSearchQuery(key, name, localized, 'threat'), true);
    assert.equal(panelMatchesSearchQuery(key, name, localized, 'threat timeline'), true);
    assert.equal(panelMatchesSearchQuery(key, name, localized, 'threat time line'), true);
    assert.equal(panelMatchesSearchQuery(key, name, localized, 'probability levels'), true);
    assert.equal(panelMatchesSearchQuery(key, name, localized, 'unrelated markets'), false);
  });
});
