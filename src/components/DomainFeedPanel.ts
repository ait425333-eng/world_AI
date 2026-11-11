import { Panel } from './Panel';
import { t } from '@/services/i18n';
import { joinSafeHtml, safeHtml, type SafeHtml } from '@/utils/sanitize';

export type DomainKind =
  | 'political'
  | 'diplomatic'
  | 'international'
  | 'cyber'
  | 'economy'
  | 'tech'
  | 'health';

interface DomainCard {
  badges: string[];
  headline: string;
  summary: string;
  age: string;
  isNew?: boolean;
}

interface DomainMeta {
  panelId: string;
  titleKey: string;
  tooltipKey: string;
  tagLabel: string;
  tagClass: string;
  samples: DomainCard[];
}

const DOMAIN_META: Record<DomainKind, DomainMeta> = {
  political: {
    panelId: 'domain-political',
    titleKey: 'panels.domainPolitical',
    tooltipKey: 'components.domainPolitical.infoTooltip',
    tagLabel: 'Political',
    tagClass: 'political',
    samples: [
      {
        badges: ['Verified'],
        headline: 'Parliament passes controversial electoral reform bill amidst protests.',
        summary:
          'The legislation, which critics argue dilutes oversight powers, passed with a narrow majority after a 12-hour debate session.',
        age: '2 minutes ago',
        isNew: true,
      },
    ],
  },
  diplomatic: {
    panelId: 'domain-diplomatic',
    titleKey: 'panels.domainDiplomatic',
    tooltipKey: 'components.domainDiplomatic.infoTooltip',
    tagLabel: 'Diplomatic',
    tagClass: 'diplomatic',
    samples: [
      {
        badges: ['Embassy'],
        headline: 'Ambassador summoned over expulsion of aid workers in Northern region.',
        summary:
          'The foreign ministry issued a formal protest today following the detention of three humanitarian staff members at a border checkpoint.',
        age: '15 minutes ago',
      },
    ],
  },
  international: {
    panelId: 'domain-international',
    titleKey: 'panels.domainInternational',
    tooltipKey: 'components.domainInternational.infoTooltip',
    tagLabel: 'International',
    tagClass: 'international',
    samples: [
      {
        badges: ['UN Report'],
        headline: 'Global summit reaches consensus on new maritime trade routes.',
        summary:
          'Delegates from 40 nations agreed to establish protected shipping corridors to ensure the safe passage of commercial goods through contested waters.',
        age: '1 hour ago',
      },
    ],
  },
  cyber: {
    panelId: 'domain-cyber',
    titleKey: 'panels.domainCyber',
    tooltipKey: 'components.domainCyber.infoTooltip',
    tagLabel: 'Cyber',
    tagClass: 'cyber',
    samples: [
      {
        badges: ['Security'],
        headline: 'Major ransomware attack targets national infrastructure grids.',
        summary:
          'Emergency response teams are currently working to restore power to affected regions as cybersecurity agencies investigate the source of the breach.',
        age: '32 minutes ago',
        isNew: true,
      },
    ],
  },
  economy: {
    panelId: 'domain-economy',
    titleKey: 'panels.domainEconomy',
    tooltipKey: 'components.domainEconomy.infoTooltip',
    tagLabel: 'Economy',
    tagClass: 'economy',
    samples: [
      {
        badges: ['Markets'],
        headline: 'Central Bank raises interest rates to combat surging inflation.',
        summary:
          'The 50-basis-point hike marks the fourth consecutive increase this year, aiming to stabilize consumer prices which have risen by 7% annually.',
        age: '1 hour ago',
      },
    ],
  },
  tech: {
    panelId: 'domain-tech',
    titleKey: 'panels.domainTech',
    tooltipKey: 'components.domainTech.infoTooltip',
    tagLabel: 'Technological',
    tagClass: 'tech',
    samples: [
      {
        badges: ['Innovation'],
        headline: 'New AI regulations proposed to ensure algorithmic transparency.',
        summary:
          'Lawmakers unveiled a draft bill requiring tech companies to disclose the training data and decision-making logic used in high-risk AI systems.',
        age: '3 hours ago',
      },
    ],
  },
  health: {
    panelId: 'domain-health',
    titleKey: 'panels.domainHealth',
    tooltipKey: 'components.domainHealth.infoTooltip',
    tagLabel: 'Health & Env',
    tagClass: 'health',
    samples: [
      {
        badges: ['Alert'],
        headline: 'Health officials confirm containment of viral outbreak in southern district.',
        summary:
          'Rapid response teams have successfully isolated the cluster, with no new cases reported in the last 48 hours according to the latest epidemiological data.',
        age: '5 minutes ago',
        isNew: true,
      },
    ],
  },
};

function renderCard(meta: DomainMeta, card: DomainCard): SafeHtml {
  const badges = joinSafeHtml(
    card.badges.map((badge) => safeHtml`<span class="domain-feed-badge">${badge}</span>`),
  );
  const newBadge = card.isNew
    ? safeHtml`<span class="domain-feed-badge domain-feed-badge--new">New</span>`
    : '';
  return safeHtml`<article class="domain-feed-card domain-feed-card--${meta.tagClass}">
    <div class="domain-feed-meta">
      <span class="domain-feed-tag domain-feed-tag--${meta.tagClass}">${meta.tagLabel}</span>
      ${badges}${newBadge}
    </div>
    <h3 class="domain-feed-headline">${card.headline}</h3>
    <p class="domain-feed-summary">${card.summary}</p>
    <div class="domain-feed-footer">${card.age}</div>
  </article>`;
}

/**
 * Domain-scoped intel card feed. Sample cards ship until live domain feeds
 * are wired; Settings → Domains ticks mount/unmount these panels.
 */
export class DomainFeedPanel extends Panel {
  constructor(domain: DomainKind) {
    const meta = DOMAIN_META[domain];
    super({
      id: meta.panelId,
      title: t(meta.titleKey),
      infoTooltip: t(meta.tooltipKey),
      showCount: true,
    });
    this.setCount(meta.samples.length);
    this.setSafeContent(
      safeHtml`<div class="domain-feed-list">${joinSafeHtml(meta.samples.map((card) => renderCard(meta, card)))}</div>`,
    );
  }
}
