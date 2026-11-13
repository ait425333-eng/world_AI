import { getConfiguredPanelSearchAliases } from '@/config/panel-search-aliases';

/** Normalize panel filter text so hyphens/underscores match spaced queries. */
export function normalizePanelSearchText(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Search aliases for a settings panel key (e.g. threat-timeline). */
export function getPanelSearchAliases(panelKey: string): string[] {
  return [...getConfiguredPanelSearchAliases(panelKey)];
}

/**
 * Settings Panels-tab matcher: key, display names, and renamed-panel aliases.
 * Multi-word queries match when every token appears across those fields
 * (so "threat time line" still finds threat-timeline / Threat Timeline).
 */
export function panelMatchesSearchQuery(
  panelKey: string,
  panelName: string,
  localizedName: string,
  query: string,
  aliases: string[] = getPanelSearchAliases(panelKey),
): boolean {
  const needle = normalizePanelSearchText(query);
  if (!needle) return true;

  const haystacks = [
    normalizePanelSearchText(panelKey),
    normalizePanelSearchText(panelName),
    normalizePanelSearchText(localizedName),
    ...aliases.map((alias) => normalizePanelSearchText(alias)),
  ].filter(Boolean);

  if (haystacks.some((hay) => hay.includes(needle))) return true;

  const tokens = needle.split(' ').filter(Boolean);
  if (tokens.length <= 1) return false;
  const blob = haystacks.join(' ');
  return tokens.every((token) => blob.includes(token));
}
