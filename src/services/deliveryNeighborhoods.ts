// Lista local de bairros com taxas fixas para economizar chamadas à API
// Variantes de nome ajudam a mapear entradas do usuário (sem acentos / versões diferentes)
export type NeighborhoodOption = {
  key: string; // identificador único
  label: string; // nome para exibir
  aliases?: string[]; // variações que o usuário pode digitar
  fee: number; // valor em reais
};

export const NEIGHBORHOOD_OPTIONS: NeighborhoodOption[] = [
  { key: 'eden', label: 'Éden', aliases: ['eden'], fee: 4 },
  { key: 'jardim_italia', label: 'Jardim Itália', aliases: ['jardim itália', 'jardim italia'], fee: 4 },
  { key: 'casa_grande', label: 'Casa Grande', aliases: ['casa grande'], fee: 6 },
  { key: 'jardim_dos_passaros', label: 'Jardim dos Pássaros', aliases: ['jardim dos pássaros', 'jardim dos passaros'], fee: 6 },
  { key: 'dona_tereza', label: 'Dona Tereza', aliases: ['dona tereza'], fee: 7 },
  { key: 'azaleia', label: 'Azaleia', aliases: ['azaleia'], fee: 7 },
  { key: 'ipiranga_1', label: 'Ipiranga 1', aliases: ['ipiranga 1', 'ipiranga1'], fee: 7 },
  { key: 'ipiranga_2', label: 'Ipiranga 2', aliases: ['ipiranga 2', 'ipiranga2'], fee: 12 },
  { key: 'campininha', label: 'Campininha', aliases: ['campininha', 'campinha'], fee: 12 },
  { key: 'cajuru', label: 'Cajuru', aliases: ['cajuru'], fee: 10 },
  { key: 'aparecidinha', label: 'Aparecidinha', aliases: ['aparecidinha'], fee: 13 },
  { key: 'vitoria_regia', label: 'Vitória Régia', aliases: ['vitória régia', 'vitoria regia', 'vitoria régia'], fee: 13 },
  { key: '3_marias', label: '3 Marias', aliases: ['3 marias', 'três marias', 'tres marias'], fee: 15 },
  { key: 'jardim_dos_reis', label: 'Jardim dos Reis', aliases: ['jardim dos reis'], fee: 10 },
  { key: 'vila_dalmata', label: 'Vila Dálmata', aliases: ['vila dálmata', 'vila dalmata'], fee: 10 },
  { key: 'jardim_italia_2', label: 'Jardim Itália (alternativo)', aliases: ['jardim italia'], fee: 4 },
  { key: 'vitoria_rez', label: 'Vitória Rez', aliases: ['vitória rez', 'vitoria rez'], fee: 12 },
  { key: 'vitoria', label: 'Vitória', aliases: ['vitória', 'vitoria'], fee: 12 },
  // incluímos também variações comuns para aumentar o acerto
];

// Normaliza texto para comparação simples (remove acentos, toLowerCase and trim)
const normalize = (s?: string) => {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
};

export const getNeighborhoodFee = (neighborhood?: string): number | null => {
  if (!neighborhood) return null;
  const n = normalize(neighborhood);
  // Prefer admin-saved list if available
  let listToCheck: NeighborhoodOption[] = NEIGHBORHOOD_OPTIONS;
  try {
    if (typeof window !== 'undefined') {
      const admin = loadAdminNeighborhoods();
      if (Array.isArray(admin) && admin.length) listToCheck = admin;
    }
  } catch (e) {
    // ignore and fallback to defaults
  }

  for (const opt of listToCheck) {
    if (normalize(opt.label) === n) return opt.fee;
    if (opt.aliases && opt.aliases.some(a => normalize(a) === n)) return opt.fee;
    // also check if input contains alias (user typed extra words)
    if (opt.aliases && opt.aliases.some(a => n.includes(normalize(a)))) return opt.fee;
    if (n.includes(normalize(opt.label))) return opt.fee;
  }
  return null;
};

export default NEIGHBORHOOD_OPTIONS;

// Admin persistence helpers (simple localStorage). Key can be replaced by backend calls later.
const ADMIN_STORAGE_KEY = 'forneiro-admin-neighborhoods';

export const loadAdminNeighborhoods = (): NeighborhoodOption[] => {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) return NEIGHBORHOOD_OPTIONS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
    return NEIGHBORHOOD_OPTIONS;
  } catch (e) {
    console.warn('Failed to load admin neighborhoods, using defaults', e);
    return NEIGHBORHOOD_OPTIONS;
  }
};

export const saveAdminNeighborhoods = (list: NeighborhoodOption[]) => {
  try {
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(list));
    // Dispatch a custom event so other windows/components can react immediately
    try {
      if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
        const ev = new CustomEvent('forneiro:neighborhoods-updated', { detail: { list } });
        window.dispatchEvent(ev);
      }
    } catch (e) {
      // ignore
    }
  } catch (e) {
    console.error('Failed to save admin neighborhoods', e);
  }
};
