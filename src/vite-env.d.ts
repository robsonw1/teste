/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_BASE: string;
	readonly VITE_WS_URL: string;
	readonly VITE_APP_NAME: string;
	readonly VITE_DEFAULT_CURRENCY: string;
	readonly VITE_AUTO_REFRESH_INTERVAL?: string;
	readonly VITE_GOOGLE_MAPS_API_KEY?: string;
	readonly VITE_RESTAURANT_ADDRESS?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
