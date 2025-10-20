// This client service proxies map-related requests to server endpoints
// Server endpoints: POST /api/maps/validate and POST /api/delivery/calculate

// Read Google Maps API key from Vite env (client) or process.env (SSR/tests). In production this MUST be set.
let GOOGLE_MAPS_API_KEY = '';
try {
  // Vite exposes client env via import.meta.env
  // @ts-ignore - import.meta may not be typed in all environments
  GOOGLE_MAPS_API_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
    ? String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '')
    : '';
} catch (e) {
  GOOGLE_MAPS_API_KEY = '';
}
if (!GOOGLE_MAPS_API_KEY) {
  // Fallback to process.env only when available (SSR/tests)
  if (typeof process !== 'undefined' && process.env) {
    GOOGLE_MAPS_API_KEY = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
  } else {
    GOOGLE_MAPS_API_KEY = '';
  }
}

// Determine environment safely (prefer import.meta.env.MODE on Vite, fallback to process.env.NODE_ENV)
const NODE_ENV = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE)
  ? String(import.meta.env.MODE)
  : (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) ? String(process.env.NODE_ENV) : 'development';

if (!GOOGLE_MAPS_API_KEY && NODE_ENV === 'production') {
  console.error('GOOGLE_MAPS_API_KEY is not set in production. Aborting.');
  throw new Error('Missing Google Maps API key');
}

const RESTAURANT_ADDRESS = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_RESTAURANT_ADDRESS)
  ? String(import.meta.env.VITE_RESTAURANT_ADDRESS)
  : ((typeof process !== 'undefined' && process.env && process.env.RESTAURANT_ADDRESS) ? String(process.env.RESTAURANT_ADDRESS) : 'Rua Hércules Franceschini, 35 - Éden, Sorocaba - SP');

interface DeliveryCalculationResult {
  fee: number;
  distance: string;
  duration: string;
  distanceInKm: number;
}

// Loader da Google Maps JavaScript API para evitar CORS na Distance Matrix HTTP
const loadGoogleMapsApi = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps) {
      resolve((window as any).google);
      return;
    }

    const existing = document.getElementById('google-maps-js');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).google));
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-js';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve((window as any).google);
    script.onerror = () => reject(new Error('Failed to load Google Maps API'));
    document.head.appendChild(script);
  });
};

export const calculateDeliveryFee = async (
  address: string,
  neighborhood: string,
  reference?: string
): Promise<DeliveryCalculationResult> => {
  const customerAddress = `${address}, ${neighborhood}, Sorocaba - SP`;

  // Try to resolve a local fixed fee first to avoid unnecessary Google Maps calls
  try {
    // Dynamically import the local neighborhoods module to keep bundle small
    const mod = await import('./deliveryNeighborhoods');
    // First, try to load admin-saved list (from localStorage) and match robustly
    try {
      const adminList = (mod.loadAdminNeighborhoods && typeof window !== 'undefined') ? mod.loadAdminNeighborhoods() : null;
      const normalize = (s: string) => s ? s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9 ]/g, '').trim() : '';
      if (Array.isArray(adminList) && adminList.length) {
        const target = normalize(neighborhood || '');
        for (const opt of adminList) {
          const key = String(opt.key || '');
          const label = String(opt.label || '');
          const aliases = Array.isArray(opt.aliases) ? opt.aliases.map(String) : [];
          if (normalize(label) === target) {
            console.info('Using admin fixed neighborhood fee (label match) for', neighborhood, opt.fee);
            return { fee: opt.fee, distance: '—', duration: '—', distanceInKm: 0 };
          }
          if (key === neighborhood) {
            console.info('Using admin fixed neighborhood fee (key match) for', neighborhood, opt.fee);
            return { fee: opt.fee, distance: '—', duration: '—', distanceInKm: 0 };
          }
          if (aliases.some(a => normalize(a) === target)) {
            console.info('Using admin fixed neighborhood fee (alias match) for', neighborhood, opt.fee);
            return { fee: opt.fee, distance: '—', duration: '—', distanceInKm: 0 };
          }
          // also check contains
          if (target.includes(normalize(label)) || aliases.some(a => target.includes(normalize(a)))) {
            console.info('Using admin fixed neighborhood fee (contains match) for', neighborhood, opt.fee);
            return { fee: opt.fee, distance: '—', duration: '—', distanceInKm: 0 };
          }
        }
      }
    } catch (e) {
      // ignore admin list lookup errors and fallback to generic getNeighborhoodFee
      console.warn('Admin neighborhood lookup failed, falling back to generic lookup', e);
    }

    // Fallback to generic helper if present
    if (mod.getNeighborhoodFee) {
      const fixedFee = mod.getNeighborhoodFee(neighborhood);
      if (fixedFee !== null) {
        console.info('Using fixed neighborhood fee (generic) for', neighborhood, fixedFee);
        return { fee: fixedFee, distance: '—', duration: '—', distanceInKm: 0 };
      }
    }
  } catch (e) {
    // If anything goes wrong with the local lookup, fall back to using Google Maps
    console.warn('Local neighborhood lookup failed, falling back to Google Maps', e);
  }

  try {
    // Primeiro, obter coordenadas do endereço do cliente
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(customerAddress)}&key=${GOOGLE_MAPS_API_KEY}`;
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();

    if (geocodeData.status !== 'OK' || !geocodeData.results.length) {
      throw new Error('Endereço não encontrado. Verifique os dados informados.');
    }

    // Calcular distância usando Google Maps JavaScript API (evita problemas de CORS)
    await loadGoogleMapsApi();
    const gmaps = (window as any).google;
    const service = new gmaps.maps.DistanceMatrixService();

    const dmResult: any = await new Promise((resolve, reject) => {
      service.getDistanceMatrix(
        {
          origins: [RESTAURANT_ADDRESS],
          destinations: [customerAddress],
          travelMode: gmaps.maps.TravelMode.DRIVING,
          unitSystem: gmaps.maps.UnitSystem.METRIC,
        },
        (response: any, status: any) => {
          if (status === 'OK') resolve(response);
          else reject(new Error('Erro ao calcular distância. Tente novamente.'));
        }
      );
    });

    if (!dmResult.rows?.[0]?.elements?.[0]) {
      throw new Error('Erro ao calcular distância. Tente novamente.');
    }

    const element = dmResult.rows[0].elements[0];
    if (element.status !== 'OK') {
      throw new Error('Rota não encontrada para o endereço informado.');
    }

    const distanceInKm = element.distance.value / 1000;
    
    // Bairros próximos em Sorocaba com taxas especiais
    const nearbyNeighborhoods = [
      'campinha', '3 marias', 'três marias', 'vitória régia', 'vitoria regia', 
      'éden', 'eden', 'jardim europa', 'centro', 'vila hortência', 'vila hortencia',
      'jardim novo mundo', 'jardim são paulo', 'jardim sao paulo', 'barcelona',
      'parque vitória', 'parque vitoria', 'vila helena', 'jardim residencial veneza',
      'vila fiori', 'jardim maria helena'
    ];
    
    const customerNeighborhood = neighborhood.toLowerCase();
    const isNearbyNeighborhood = nearbyNeighborhoods.some(n => 
      customerNeighborhood.includes(n) || n.includes(customerNeighborhood)
    );
    
    // Aplicar regras de taxa baseadas na distância e localização
    let fee = 20.00; // Taxa padrão para locais distantes
    
    // Para bairros próximos conhecidos, aplicar taxa reduzida mesmo se a distância calculada for maior
    if (isNearbyNeighborhood && distanceInKm <= 8) {
      if (distanceInKm <= 2) {
        fee = 4.00;
      } else if (distanceInKm <= 3.5) {
        fee = 6.00;
      } else if (distanceInKm <= 5) {
        fee = 8.00;
      } else {
        fee = 10.00;
      }
    } else {
      // Para outros locais, usar cálculo normal de distância
      if (distanceInKm <= 2) {
        fee = 4.00;
      } else if (distanceInKm <= 2.5) {
        fee = 6.00;
      } else if (distanceInKm <= 3) {
        fee = 7.00;
      } else if (distanceInKm <= 4) {
        fee = 10.00;
      } else if (distanceInKm <= 6) {
        fee = 12.00;
      } else if (distanceInKm <= 8) {
        fee = 15.00;
      } else if (distanceInKm <= 12) {
        fee = 18.00;
      }
    }

    return {
      fee,
      distance: element.distance.text,
      duration: element.duration.text,
      distanceInKm
    };

  } catch (error) {
    console.error('Erro ao calcular taxa de entrega:', error);
    throw error;
  }
};

export const validateAddress = async (address: string, neighborhood: string): Promise<boolean> => {
  try {
    const customerAddress = `${address}, ${neighborhood}, Sorocaba - SP`;
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(customerAddress)}&key=${GOOGLE_MAPS_API_KEY}`;
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();

    return geocodeData.status === 'OK' && geocodeData.results.length > 0;
  } catch (error) {
    console.error('Erro ao validar endereço:', error);
    return false;
  }
};
