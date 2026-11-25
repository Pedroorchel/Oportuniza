import { Job } from '../types';

export interface GeoPoint {
  lat: number;
  lng: number;
  label?: string;
}

/**
 * Coordenadas geográficas reais (SIRGAS2000 / OpenStreetMap) dos principais
 * bairros e polos industriais de Araucária - PR.
 */
export const ARAUCARIA_NEIGHBORHOOD_COORDS: Record<string, GeoPoint> = {
  'Centro': { lat: -25.5859, lng: -49.4047, label: 'Centro - Araucária' },
  'Araucária Sede': { lat: -25.5874, lng: -49.4050, label: 'Sede - Araucária' },
  'Costeira': { lat: -25.5938, lng: -49.3749, label: 'Costeira - Araucária' },
  'Capela Velha': { lat: -25.5516, lng: -49.3938, label: 'Capela Velha - Araucária' },
  'Fazenda Velha': { lat: -25.5740, lng: -49.4050, label: 'Fazenda Velha - Araucária' },
  'Iguaçu': { lat: -25.6032, lng: -49.3870, label: 'Iguaçu - Araucária' },
  'Thomaz Coelho': { lat: -25.5420, lng: -49.3550, label: 'Thomaz Coelho - Araucária' },
  'Campina da Barra': { lat: -25.6215, lng: -49.3686, label: 'Campina da Barra - Araucária' },
  'Tindiquera': { lat: -25.5762, lng: -49.3617, label: 'Tindiquera - Araucária' },
  'Estação': { lat: -25.5690, lng: -49.3960, label: 'Estação - Araucária' },
  'Barigui': { lat: -25.5220, lng: -49.3490, label: 'Barigui - Araucária' },
  'Boqueirão': { lat: -25.5733, lng: -49.4170, label: 'Boqueirão - Araucária' },
  'Passa Dois': { lat: -25.5690, lng: -49.4115, label: 'Jardim Passa Dois - Araucária' },
  'Itaqui': { lat: -25.5580, lng: -49.4280, label: 'Itaqui - Araucária' },
  'Polo Industrial / Petrobras': { lat: -25.5720, lng: -49.3750, label: 'REPAR / Polo Petrobras - Araucária' },
  'Polo Petrobras': { lat: -25.5720, lng: -49.3750, label: 'REPAR / Polo Petrobras - Araucária' },
  'Outros': { lat: -25.5859, lng: -49.4047, label: 'Araucária - PR' },
};

/**
 * Coordenadas reais de hubs empresariais e tecnológicos em Curitiba e Região Metropolitana.
 */
export const CURITIBA_HUB_COORDS: Record<string, GeoPoint> = {
  'centro': { lat: -25.4284, lng: -49.2733, label: 'Centro - Curitiba' },
  'centro civico': { lat: -25.4188, lng: -49.2686, label: 'Centro Cívico - Curitiba' },
  'batel': { lat: -25.4422, lng: -49.2869, label: 'Batel - Curitiba' },
  'agua verde': { lat: -25.4519, lng: -49.2814, label: 'Água Verde - Curitiba' },
  'reboucas': { lat: -25.4498, lng: -49.2572, label: 'Rebouças / Tecnoparque - Curitiba' },
  'portao': { lat: -25.4766, lng: -49.2916, label: 'Portão - Curitiba' },
  'cic': { lat: -25.4980, lng: -49.3290, label: 'Cidade Industrial (CIC) - Curitiba' },
  'juveve': { lat: -25.4148, lng: -49.2598, label: 'Juvevê - Curitiba' },
  'boqueirao_cwb': { lat: -25.5045, lng: -49.2368, label: 'Boqueirão - Curitiba' },
  'pinhais': { lat: -25.4447, lng: -49.1924, label: 'Pinhais - PR' },
  'taruma': { lat: -25.4265, lng: -49.2420, label: 'Tarumã - Curitiba' },
};

const CURITIBA_TECH_ROTATION: GeoPoint[] = [
  CURITIBA_HUB_COORDS['centro civico'],
  CURITIBA_HUB_COORDS['batel'],
  CURITIBA_HUB_COORDS['agua verde'],
  CURITIBA_HUB_COORDS['reboucas'],
  CURITIBA_HUB_COORDS['centro'],
  CURITIBA_HUB_COORDS['portao'],
  CURITIBA_HUB_COORDS['cic'],
  CURITIBA_HUB_COORDS['juveve'],
];

function normalizeText(value?: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Deslocamento determinístico mínimo (~90m–180m) para que vagas no mesmo bairro
 * não fiquem empilhadas no mesmo pixel e todas possam ser clicadas no mapa.
 */
function deterministicSpread(id: string, base: GeoPoint): GeoPoint {
  const h = hashSeed(id || 'job');
  const angle = ((h % 360) * Math.PI) / 180;
  const radius = 0.0012 + ((h % 5) * 0.00045);
  return {
    lat: Number((base.lat + Math.sin(angle) * radius).toFixed(5)),
    lng: Number((base.lng + Math.cos(angle) * radius).toFixed(5)),
  };
}

/**
 * Detecta o padrão antigo linear quebrado (-25.42..-25.56 passo 0.01) que colocava
 * vagas remotas e de Curitiba fora dos locais corretos.
 */
function isLegacyDiagonalCoord(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const latDiff = lat - -25.42;
  const lngDiff = lng - -49.27;
  const matchesDiagonal = Math.abs(latDiff - lngDiff) < 0.0015 && lat <= -25.419 && lat >= -25.565;
  const isRoundStep = Math.abs((lat * 100) - Math.round(lat * 100)) < 0.0005 && Math.abs((lng * 100) - Math.round(lng * 100)) < 0.0005;
  return matchesDiagonal && isRoundStep;
}

export function isValidMetroCoord(lat?: number | null, lng?: number | null): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return false;
  // Região Metropolitana de Curitiba / Araucária
  return lat <= -25.25 && lat >= -25.80 && lng <= -49.05 && lng >= -49.65;
}

export function resolveCoordinatesByLocation(params: {
  id?: string;
  location?: string;
  neighborhood?: string;
  address?: string;
  isRemote?: boolean;
  spread?: boolean;
}): GeoPoint {
  const combined = normalizeText(
    `${params.neighborhood || ''} ${params.location || ''} ${params.address || ''}`
  );
  const seedKey = params.id || combined || 'araucaria';

  // 1. Verificar bairros e polos de Araucária primeiro
  if (combined.includes('repar') || combined.includes('petrobras') || combined.includes('polo industrial')) {
    const base = ARAUCARIA_NEIGHBORHOOD_COORDS['Polo Industrial / Petrobras'];
    return params.spread === false ? base : deterministicSpread(seedKey, base);
  }

  for (const [name, coords] of Object.entries(ARAUCARIA_NEIGHBORHOOD_COORDS)) {
    const cleanName = normalizeText(name);
    if (cleanName && cleanName !== 'outros' && combined.includes(cleanName)) {
      // Se mencionou Boqueirão explicitamente com Curitiba, usar Boqueirão de Curitiba
      if (cleanName === 'boqueirao' && combined.includes('curitiba')) {
        const cwbBoq = CURITIBA_HUB_COORDS['boqueirao_cwb'];
        return params.spread === false ? cwbBoq : deterministicSpread(seedKey, cwbBoq);
      }
      return params.spread === false ? coords : deterministicSpread(seedKey, coords);
    }
  }

  // 2. Verificar menções de Pinhais / bairros de Curitiba
  if (combined.includes('pinhais')) {
    const base = CURITIBA_HUB_COORDS['pinhais'];
    return params.spread === false ? base : deterministicSpread(seedKey, base);
  }
  for (const [key, coords] of Object.entries(CURITIBA_HUB_COORDS)) {
    if (key !== 'boqueirao_cwb' && combined.includes(key)) {
      return params.spread === false ? coords : deterministicSpread(seedKey, coords);
    }
  }

  // 3. Se mencionar Curitiba ou for vaga Remota sem bairro específico
  if (combined.includes('curitiba')) {
    const idx = hashSeed(seedKey) % CURITIBA_TECH_ROTATION.length;
    const base = CURITIBA_TECH_ROTATION[idx];
    return params.spread === false ? base : deterministicSpread(seedKey, base);
  }

  if (combined.includes('remoto') || params.isRemote) {
    // Distribuir vagas remotas entre sede Araucária Centro e polos tech de Curitiba
    const pool = [
      ARAUCARIA_NEIGHBORHOOD_COORDS['Centro'],
      CURITIBA_HUB_COORDS['centro civico'],
      CURITIBA_HUB_COORDS['batel'],
      CURITIBA_HUB_COORDS['reboucas'],
      CURITIBA_HUB_COORDS['agua verde'],
    ];
    const base = pool[hashSeed(seedKey) % pool.length];
    return params.spread === false ? base : deterministicSpread(seedKey, base);
  }

  // 4. Fallback padrão: Centro de Araucária
  const base = ARAUCARIA_NEIGHBORHOOD_COORDS['Centro'];
  return params.spread === false ? base : deterministicSpread(seedKey, base);
}

/**
 * Resolve as coordenadas definitivas de uma vaga, preservando pinos customizados válidos
 * e corrigindo coordenadas nulas, fora da região ou geradas pelo padrão diagonal legado.
 */
export function resolveJobCoordinates(
  job: Pick<Job, 'id' | 'lat' | 'lng' | 'location' | 'companyNeighborhood' | 'companyAddress' | 'isRemote'>,
  seedCoordsById?: Map<string, GeoPoint>
): GeoPoint {
  if (seedCoordsById && job.id && seedCoordsById.has(job.id)) {
    return seedCoordsById.get(job.id)!;
  }

  const rawLat = typeof job.lat === 'string' ? parseFloat(job.lat) : job.lat;
  const rawLng = typeof job.lng === 'string' ? parseFloat(job.lng) : job.lng;

  if (isValidMetroCoord(rawLat, rawLng) && !isLegacyDiagonalCoord(rawLat!, rawLng!)) {
    return { lat: Number(rawLat), lng: Number(rawLng) };
  }

  return resolveCoordinatesByLocation({
    id: job.id,
    location: job.location,
    neighborhood: job.companyNeighborhood,
    address: job.companyAddress,
    isRemote: job.isRemote,
    spread: true,
  });
}
