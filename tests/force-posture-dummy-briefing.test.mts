import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('Force Posture dummy briefing', () => {
  it('embeds IA / IN / IAF placeholder bullets in MilitaryCorrelationPanel', () => {
    const panel = readFileSync(resolve(root, 'src/components/MilitaryCorrelationPanel.ts'), 'utf8');

    assert.match(panel, /FORCE_POSTURE_DUMMY_SECTIONS/);
    assert.match(panel, /code: 'IA'/);
    assert.match(panel, /code: 'IN'/);
    assert.match(panel, /code: 'IAF'/);
    assert.match(panel, /20 Mtn Div \/ 33Corps/);
    assert.match(panel, /Loading of AC carrs at karvar/);
    assert.match(panel, /rafel acs ex 101 Sqn/);
    assert.match(panel, /buildDummyBriefingSupplement/);
    assert.match(panel, /force-posture-dummy-briefing/);
  });
});
