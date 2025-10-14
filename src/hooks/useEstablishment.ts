import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import defaultLogo from '@/assets/aezap-logo.png';

interface EstablishmentSettings {
  name: string;
  logo?: string;
  // deliveryTime, pickupTime and paymentMethods removed
}

interface EstablishmentStore {
  settings: EstablishmentSettings;
  updateSettings: (newSettings: Partial<EstablishmentSettings>) => void;
}

const DEFAULT_SETTINGS: EstablishmentSettings = {
  name: 'Forneiro Éden',
  logo: defaultLogo,
};

export const useEstablishment = create<EstablishmentStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ...newSettings,
          },
        })),
    }),
    {
      name: 'establishment-settings',
    }
  )
);