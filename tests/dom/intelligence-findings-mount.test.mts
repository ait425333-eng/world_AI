import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { IntelligenceGapBadge } from '@/components/IntelligenceGapBadge';
import { initTestI18n } from './helpers/i18n.mts';

beforeAll(initTestI18n);

beforeEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

function mountProbableScenariosHeader(): HTMLElement {
  const panel = document.createElement('div');
  panel.dataset.panel = 'threat-timeline';
  panel.innerHTML = `
    <div class="panel-header">
      <div class="panel-header-left">
        <span class="panel-title">Probable Scenarios</span>
        <div class="panel-info-wrapper"><button type="button" class="panel-info-btn">?</button></div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  return panel.querySelector('.panel-header-left')!;
}

it('places the threat-indicators count immediately after the Probable Scenarios ? control', () => {
  const headerLeft = mountProbableScenariosHeader();
  const badge = new IntelligenceGapBadge();

  const info = headerLeft.querySelector('.panel-info-wrapper');
  const mounted = headerLeft.querySelector('.intel-findings-badge');
  expect(mounted).toBeTruthy();
  expect(mounted?.previousElementSibling).toBe(info);
  expect(document.querySelector('.header-right .intel-findings-badge')).toBeNull();

  badge.destroy();
});

it('remounts beside the ? when Probable Scenarios appears after the badge', async () => {
  const badge = new IntelligenceGapBadge();
  expect(document.querySelector('.intel-findings-badge')).toBeNull();

  const headerLeft = mountProbableScenariosHeader();
  await vi.waitFor(() => {
    expect(headerLeft.querySelector('.intel-findings-badge')).toBeTruthy();
  });

  const info = headerLeft.querySelector('.panel-info-wrapper');
  expect(headerLeft.querySelector('.intel-findings-badge')?.previousElementSibling).toBe(info);

  badge.destroy();
});
