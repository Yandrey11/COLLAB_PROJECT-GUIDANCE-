/**
 * Public reCAPTCHA v2 site key from Vite env.
 * Add to frontend/.env: VITE_RECAPTCHA_SITE_KEY=your_key
 * (Create frontend/.env from frontend/.env.example if needed.)
 */
export function getRecaptchaSiteKey() {
  return (import.meta.env.VITE_RECAPTCHA_SITE_KEY || "").trim();
}
