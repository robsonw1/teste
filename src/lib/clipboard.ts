import { safeRemove } from './utils'

/**
 * Copy text to clipboard with robust fallbacks for older or embedded WebViews.
 * Returns true when the copy was likely successful, false otherwise.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text && text !== '') return false;
  // Try modern clipboard API first
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    // swallow and fallback
    // console.warn('navigator.clipboard.writeText failed', err)
  }

  // Fallback: create a textarea, select and execCommand('copy')
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    // Put off-screen to avoid scroll jump
    textArea.style.position = 'fixed'
    textArea.style.left = '-9999px'
    textArea.setAttribute('readonly', '')

    let appended = false
    try {
      if (document && document.body && typeof document.body.appendChild === 'function') {
        document.body.appendChild(textArea)
        appended = true
      }
      if (appended) {
        try {
          textArea.focus()
          textArea.select()
          // document.execCommand returns a boolean in many browsers
          const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false
          return !!ok
        } catch (innerErr) {
          // swallow
        }
      }
    } catch (err) {
      // swallow
    } finally {
      try {
        safeRemove(textArea)
      } catch (remErr) {
        // swallow
      }
    }
  } catch (err) {
    // swallow
  }

  return false
}

export default copyText
