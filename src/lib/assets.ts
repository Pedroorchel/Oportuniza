/**
 * Returns true if the given logo/image string represents an actual image URL or asset path
 * rather than a Lucide icon identifier (e.g. 'Briefcase').
 */
export function isImageAssetUrl(value?: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(https?:|data:|blob:|\/\/|\/|\.\/|assets\/)/i.test(trimmed)) {
    return true;
  }
  return /\.(png|jpe?g|webp|gif|svg|ico)(\?.*)?$/i.test(trimmed);
}

/**
 * Resolves static asset URLs from `public/` safely across both root previews (`./`)
 * and GitHub Pages repository subpaths (e.g., `/oportunizae/`).
 * Idempotent across repeated calls and preserves bare icon identifiers untouched.
 */
export function resolveAssetUrl(assetPath?: string): string {
  if (!assetPath) return '';
  const trimmed = assetPath.trim();
  if (!trimmed) return '';
  if (/^(https?:|data:|blob:|\/\/)/i.test(trimmed)) {
    return trimmed;
  }

  // Keep bare icon names like 'Briefcase' or 'Building2' untouched
  if (!trimmed.includes('/') && !/\.(png|jpe?g|webp|gif|svg|ico)(\?.*)?$/i.test(trimmed)) {
    return trimmed;
  }

  const base = import.meta.env.BASE_URL || './';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;

  // Normalize any canonical `assets/...` path idempotently against current BASE_URL
  const assetsIdx = trimmed.indexOf('assets/');
  if (assetsIdx !== -1) {
    return `${normalizedBase}${trimmed.slice(assetsIdx)}`;
  }

  if (trimmed.startsWith(normalizedBase)) {
    return trimmed;
  }

  const cleanRelative = trimmed.replace(/^(\.\/|\/)+/, '');
  return `${normalizedBase}${cleanRelative}`;
}
