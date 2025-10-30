import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely remove a DOM node if it's still attached to a parent.
 * Some embedded WebViews (MIUI custom WebView, old Android WebViews) may
 * throw when removeChild() is invoked on a node that is already detached
 * or when parent/child relationships change quickly. Use this helper to
 * guard removals.
 */
export function safeRemove(node: Node | null | undefined) {
  if (!node) return false;
  try {
    // Prefer the modern remove() method when available and the node is connected
    // because it's simpler and less error-prone in some environments.
    // But call it only if node.isConnected is true or parent contains it.
    // Some legacy WebViews don't implement isConnected reliably, so we fallback
    // to parentNode checks.
    const anyNode = node as any;
    if (typeof anyNode.remove === 'function') {
      // Guard with a connectivity check when possible
      try {
        if ((node as any).isConnected === true) {
          anyNode.remove();
          return true;
        }
      } catch (e) {
        // ignore and fallback to parent removal below
      }
    }

    const parent = node.parentNode;
    if (parent && typeof parent.removeChild === 'function') {
      // double-check that parent actually contains node to avoid NotFoundError
      if ((parent as Node).contains && (parent as Node).contains(node)) {
        parent.removeChild(node);
        return true;
      }
    }
  } catch (err) {
    // Some environments may still throw; swallow to avoid crashing the app.
    // The error will be logged by callers if desired.
  }
  return false;
}
