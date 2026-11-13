import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURATED_FULL_DEFAULT_PANEL_KEYS,
  FREE_MAX_PANELS,
  getInitialPanelSettingsForVariant,
} from '../src/config/panels.ts';

describe('curated full-variant panel defaults', () => {
  it('enables only the curated core boards by default', () => {
    const settings = getInitialPanelSettingsForVariant('full');
    const enabled = Object.entries(settings)
      .filter(([, config]) => config.enabled)
      .map(([key]) => key)
      .sort();

    assert.deepEqual(enabled, [...CURATED_FULL_DEFAULT_PANEL_KEYS].sort());
    assert.ok(enabled.length <= FREE_MAX_PANELS);
  });

  it('keeps Probable Scenarios, Strategic Risk, Force Posture, and domain feeds on', () => {
    const settings = getInitialPanelSettingsForVariant('full');
    for (const key of [
      'threat-timeline',
      'strategic-risk',
      'military-correlation',
      'domain-political',
      'domain-diplomatic',
      'domain-international',
      'domain-cyber',
      'domain-economy',
      'domain-tech',
      'domain-health',
    ]) {
      assert.equal(settings[key]?.enabled, true, `${key} should be enabled by default`);
    }
  });
});
