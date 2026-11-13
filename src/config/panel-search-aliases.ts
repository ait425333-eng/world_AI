/**
 * Extra Settings / command search terms for renamed panels.
 * Keep these free of i18n imports so node tests can load them directly.
 */
export const PANEL_SEARCH_ALIASES: Record<string, readonly string[]> = {
  'threat-timeline': [
    'threat timeline',
    'threat time line',
    'probable scenarios',
    'probable',
    'scenarios',
    'probability levels',
    'threat levels',
    'threat trend',
    'timeline',
    'security escalation',
  ],
};

export function getConfiguredPanelSearchAliases(panelKey: string): readonly string[] {
  return PANEL_SEARCH_ALIASES[panelKey] ?? [];
}
