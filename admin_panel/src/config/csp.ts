// Content-Security-Policy for the admin panel (used by helmet in app.ts; checked in tests/security.test.js).
//
// The panel has no inline scripts or on…="" handlers any more (delegated data-* handlers,
// public/js/ui/actions.js), so scripts are 'self' only: an injected <script> or attribute handler
// does not run. No style="" attributes either: per-element styles are data-style="…", applied through
// the CSSOM by public/js/ui/style-attr.js (CSSOM changes are not restricted by CSP), so no 'unsafe-inline'
// anywhere.
// Also: no third-party scripts, no connections to other origins (an injected script cannot send the
// token elsewhere via fetch/XHR), no plugins/objects, no framing by other sites, and forms only to
// this origin.
export const cspDirectives: Record<string, string[]> = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  scriptSrcAttr: ["'none'"],
  styleSrc: ["'self'"],
  styleSrcAttr: ["'none'"],
  imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
  mediaSrc: ["'self'", 'blob:', 'https:'],
  fontSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  frameSrc: ["'self'", 'https://www.aparat.com'],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'self'"],
};

// The header value helmet sends for these directives (camelCase -> kebab-case)
export function cspHeader(directives: Record<string, string[]> = cspDirectives): string {
  return Object.entries(directives)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())} ${v.join(' ')}`)
    .join(';');
}
