// ============================================
// PROTEÇÃO GLOBAL CONTRA BUG XIAOMI/MIUI
// ============================================
if (typeof window !== 'undefined' && /miui|xiaomi|redmi|mi browser/i.test(navigator.userAgent)) {
	const originalRemoveChild = Node.prototype.removeChild;
	const originalRemove = Element.prototype.remove;
  
	Node.prototype.removeChild = function(child) {
		try {
			if (this.contains(child)) {
				return originalRemoveChild.call(this, child);
			}
			console.warn('[MIUI Fix] Prevented removeChild error - node not a child');
			return child;
		} catch (e) {
			console.error('[MIUI Fix] Error intercepted:', e);
			return child;
		}
	} as any;
  
	Element.prototype.remove = function() {
		try {
			if (this.parentNode) {
				originalRemove.call(this);
			}
		} catch (e) {
			console.warn('[MIUI Fix] Prevented remove error:', e);
		}
	};
  
	console.log('✅ [MIUI Fix] Xiaomi compatibility mode enabled');
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
