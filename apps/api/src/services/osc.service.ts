import type { Redis } from 'ioredis';
import type { OrganizationSize } from '@prisma/client';
import { cnaesToAreas } from '../utils/cnae-to-area.js';

// Brasil API — dados públicos da Receita Federal via CNPJ
// https://brasilapi.com.br/docs#tag/CNPJ
const BRASIL_API_BASE = 'https://brasilapi.com.br/api/cnpj/v1';
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const CACHE_PREFIX = 'osc:cnpj:';

export interface OscProfile {
  cnpj: string;
  name: string;
  areas: string[];
  size: OrganizationSize;
  state: string;
  city: string;
  rawSize: string;
}

interface BrasilApiCnpjResponse {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  municipio?: string;
  uf?: string;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: Array<{ codigo?: number; descricao?: string }>;
  natureza_juridica?: string;
  porte?: string;
  situacao_cadastral?: number;
  descricao_situacao_cadastral?: string;
}

export async function fetchOscProfile(cnpj: string, redis: Redis): Promise<OscProfile | null> {
  const cacheKey = `${CACHE_PREFIX}${cnpj}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as OscProfile;
  }

  const profile = await fetchFromBrasilApi(cnpj);

  if (profile) {
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(profile));
  }

  return profile;
}

async function fetchFromBrasilApi(cnpj: string): Promise<OscProfile | null> {
  const url = `${BRASIL_API_BASE}/${cnpj}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
    },
  });

  if (response.status === 400 || response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Brasil API CNPJ error: ${response.status}`);
  }

  const body = (await response.json()) as BrasilApiCnpjResponse;

  if (!body.razao_social) return null;

  // Skip inactive CNPJs (situacao_cadastral 2 = Ativa)
  if (body.situacao_cadastral !== undefined && body.situacao_cadastral !== 2) return null;

  return mapItem(cnpj, body);
}

function mapItem(cnpjFallback: string, item: BrasilApiCnpjResponse): OscProfile {
  const name = item.nome_fantasia?.trim() || item.razao_social?.trim() || '';

  const areas = cnaesToAreas(item.cnae_fiscal, item.cnaes_secundarios ?? []);

  return {
    cnpj: (item.cnpj ?? cnpjFallback).replace(/\D/g, ''),
    name,
    areas,
    size: mapPorteToSize(item.porte),
    state: item.uf?.trim() ?? '',
    city: item.municipio?.trim() ?? '',
    rawSize: item.porte ?? '',
  };
}

function mapPorteToSize(porte: string | undefined): OrganizationSize {
  switch (porte?.toUpperCase()) {
    case 'EPP':
      return 'SMALL';
    case 'MEDIO':
      return 'MEDIUM';
    case 'GRANDE':
      return 'LARGE';
    default:
      return 'MICRO'; // 'ME' (Microempresa) and unknown
  }
}
