// This client service proxies map-related requests to server endpoints
// Server endpoints: POST /api/maps/validate and POST /api/delivery/calculate

// Read Google Maps API key from Vite env (client) or process.env (SSR/tests). In production this MUST be set.
// This module now performs delivery fee calculation solely based on a local/admin-managed
// list of neighborhoods. Google Maps is not used anymore.

const RESTAURANT_ADDRESS = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_RESTAURANT_ADDRESS)
  ? String(import.meta.env.VITE_RESTAURANT_ADDRESS)
  : ((typeof process !== 'undefined' && process.env && process.env.RESTAURANT_ADDRESS) ? String(process.env.RESTAURANT_ADDRESS) : 'Rua Hércules Franceschini, 35 - Éden, Sorocaba - SP');

interface DeliveryCalculationResult {
  fee: number;
  distance: string;
  duration: string;
  distanceInKm: number;
}

// No external API loader required anymore.

export const calculateDeliveryFee = async (
  address: string,
  neighborhood: string,
  reference?: string
): Promise<DeliveryCalculationResult> => {
  // Calculation now depends only on the admin/default neighborhoods list.
  try {
    const mod = await import('./deliveryNeighborhoods');
    // prefer admin-saved list
    let list = (mod.loadAdminNeighborhoods && typeof window !== 'undefined') ? mod.loadAdminNeighborhoods() : (mod.default || mod.NEIGHBORHOOD_OPTIONS);
    if (!Array.isArray(list) || !list.length) list = (mod.default || mod.NEIGHBORHOOD_OPTIONS);

    const normalize = (s: string) => s ? s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9 ]/g, '').trim() : '';
    const target = normalize(neighborhood || '');

    // try exact/alias/key/contains match
    for (const opt of list) {
      const key = String(opt.key || '');
      const label = String(opt.label || '');
      const aliases = Array.isArray(opt.aliases) ? opt.aliases : [];
      if (normalize(label) === target) {
        return { fee: Number(opt.fee), distance: '—', duration: '—', distanceInKm: 0 };
      }
      if (key === neighborhood) {
        return { fee: Number(opt.fee), distance: '—', duration: '—', distanceInKm: 0 };
      }
      if (aliases.some((a: string) => normalize(a) === target)) {
        return { fee: Number(opt.fee), distance: '—', duration: '—', distanceInKm: 0 };
      }
      if (target.includes(normalize(label)) || aliases.some((a: string) => target.includes(normalize(a)))) {
        return { fee: Number(opt.fee), distance: '—', duration: '—', distanceInKm: 0 };
      }
    }

    // Not found: return a default fee (business decision). Using 20.00 as previous fallback.
    return { fee: 20.00, distance: '—', duration: '—', distanceInKm: 0 };
  } catch (error) {
    console.error('Erro ao calcular taxa de entrega (neighborhood-only):', error);
    // final fallback
    return { fee: 20.00, distance: '—', duration: '—', distanceInKm: 0 };
  }
};

export const validateAddress = async (address: string, neighborhood: string): Promise<boolean> => {
  try {
    // Simple validation based on presence and neighborhood list (no external API)
    if (!address || !neighborhood) return false;
    const mod = await import('./deliveryNeighborhoods');
    const list = (mod.loadAdminNeighborhoods && typeof window !== 'undefined') ? mod.loadAdminNeighborhoods() : (mod.default || mod.NEIGHBORHOOD_OPTIONS);
    const normalize = (s: string) => s ? s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9 ]/g, '').trim() : '';
    const target = normalize(neighborhood || '');
    if (!Array.isArray(list)) return false;
    return list.some((opt: any) => {
      const label = String(opt.label || '');
      const key = String(opt.key || '');
      const aliases = Array.isArray(opt.aliases) ? opt.aliases : [];
      if (normalize(label) === target) return true;
      if (key === neighborhood) return true;
      if (aliases.some((a: string) => normalize(a) === target)) return true;
      return target.includes(normalize(label));
    });
  } catch (error) {
    console.error('Erro ao validar endereço (neighborhood-only):', error);
    return false;
  }
};
