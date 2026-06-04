import type { OrganizationSize, OpportunityScope } from '@capta/db';

export type CompatibilityLevel = 'ALTO' | 'MEDIO' | 'BAIXO';

export interface CompatibilityResult {
  score: number;
  level: CompatibilityLevel;
  reasons: string[];
}

type OrgInput = {
  areas: string[];
  size: OrganizationSize;
  location: string;
};

type OppInput = {
  areas: string[];
  scope: OpportunityScope;
  scopeLocation: string | null;
  targetSizes: OrganizationSize[];
};

const SIZE_LABELS: Record<OrganizationSize, string> = {
  MICRO: 'Microempreendedora',
  SMALL: 'Pequeno porte',
  MEDIUM: 'Médio porte',
  LARGE: 'Grande porte',
};

function fmt(area: string): string {
  return area.charAt(0).toUpperCase() + area.slice(1).toLowerCase();
}

export function calculateCompatibility(org: OrgInput, opp: OppInput): CompatibilityResult {
  const reasons: string[] = [];

  // ── 1. Area compatibility (weight 40%) ──────────────────────────────────────
  const orgAreas = org.areas.map((a) => a.toLowerCase().trim());
  const oppAreas = opp.areas.map((a) => a.toLowerCase().trim());
  const common = orgAreas.filter((a) => oppAreas.includes(a));

  let areaScore: number;
  if (common.length > 0) {
    reasons.push(`Sua área de ${fmt(common[0])} coincide com este edital`);
    areaScore = 100;
  } else {
    const orgLabel = org.areas.slice(0, 2).map(fmt).join(', ') || 'não especificada';
    reasons.push(`Sem sobreposição de área: sua organização atua em ${orgLabel}`);
    areaScore = 0;
  }

  // ── 2. Size compatibility (weight 30%) ──────────────────────────────────────
  let sizeScore: number;
  if (!opp.targetSizes || opp.targetSizes.length === 0) {
    reasons.push('Edital sem restrição de porte organizacional');
    sizeScore = 100;
  } else if (opp.targetSizes.includes(org.size)) {
    reasons.push(`Seu porte (${SIZE_LABELS[org.size]}) é elegível para este edital`);
    sizeScore = 100;
  } else {
    const allowed = opp.targetSizes.map((s) => SIZE_LABELS[s]).join(' ou ');
    reasons.push(`Edital restrito a organizações de porte ${allowed}`);
    sizeScore = 20;
  }

  // ── 3. Geographic compatibility (weight 30%) ────────────────────────────────
  let geoScore: number;
  if (opp.scope === 'NATIONAL') {
    reasons.push('Edital de abrangência nacional');
    geoScore = 100;
  } else if (opp.scope === 'STATE') {
    const oppState = (opp.scopeLocation ?? '').toUpperCase();
    const orgLoc = org.location.toUpperCase();
    if (oppState && orgLoc.includes(oppState)) {
      reasons.push(`Sua organização está no estado elegível (${opp.scopeLocation})`);
      geoScore = 100;
    } else {
      reasons.push(`Edital restrito ao estado de ${opp.scopeLocation ?? 'não informado'}`);
      geoScore = 40;
    }
  } else {
    // MUNICIPAL
    const oppCity = (opp.scopeLocation ?? '').toLowerCase();
    const orgLoc = org.location.toLowerCase();
    if (oppCity && (orgLoc.includes(oppCity) || oppCity.includes(orgLoc))) {
      reasons.push(`Sua organização está no município elegível (${opp.scopeLocation})`);
      geoScore = 100;
    } else {
      reasons.push(`Edital restrito ao município de ${opp.scopeLocation ?? 'não informado'}`);
      geoScore = 0;
    }
  }

  const score = Math.round(areaScore * 0.4 + sizeScore * 0.3 + geoScore * 0.3);
  const level: CompatibilityLevel = score >= 70 ? 'ALTO' : score >= 40 ? 'MEDIO' : 'BAIXO';

  return { score, level, reasons };
}
