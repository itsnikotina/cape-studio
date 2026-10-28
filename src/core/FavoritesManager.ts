export interface FavoriteColor {
  hex: string;
  alpha: number; // 0 - 255
}

export const STORAGE_KEY_FAVORITES = 'cape_studio_favorites';

export const DEFAULT_FAVORITES: FavoriteColor[] = [
  { hex: '#B01E28', alpha: 255 }, // Mojang Red
  { hex: '#4AEDD9', alpha: 255 }, // Diamond Cyan
  { hex: '#FFAC00', alpha: 255 }, // Minecon Gold
  { hex: '#17DD62', alpha: 255 }, // Emerald Green
  { hex: '#9A5CC6', alpha: 255 }, // Amethyst Purple
  { hex: '#FFFFFF', alpha: 255 }, // White
];

/**
 * Normalizes hex code to uppercase #RRGGBB format
 */
export function normalizeHex(hex: string): string | null {
  if (!hex || typeof hex !== 'string') return null;
  let clean = hex.trim();
  if (!clean.startsWith('#')) clean = `#${clean}`;
  // Expand 3-digit hex (#RGB -> #RRGGBB)
  if (/^#[0-9A-Fa-f]{3}$/.test(clean)) {
    const r = clean[1];
    const g = clean[2];
    const b = clean[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
    return clean.toUpperCase();
  }
  return null;
}

/**
 * Compares two colors for exact equality (hex and alpha)
 */
export function isSameFavorite(a: FavoriteColor, b: FavoriteColor): boolean {
  const hexA = normalizeHex(a.hex);
  const hexB = normalizeHex(b.hex);
  if (!hexA || !hexB) return false;
  return hexA === hexB && Math.round(a.alpha) === Math.round(b.alpha);
}

/**
 * Loads and validates saved favorite colors from storage
 */
export function loadSavedFavorites(customStorage?: Storage): FavoriteColor[] {
  try {
    const storage = customStorage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!storage) return DEFAULT_FAVORITES;
    const raw = storage.getItem(STORAGE_KEY_FAVORITES);
    if (!raw) return DEFAULT_FAVORITES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_FAVORITES;

    const validated: FavoriteColor[] = [];
    for (const item of parsed) {
      if (item && typeof item === 'object') {
        const hex = normalizeHex(item.hex);
        const alpha = typeof item.alpha === 'number' && !isNaN(item.alpha) ? Math.max(0, Math.min(255, Math.round(item.alpha))) : 255;
        if (hex) {
          const entry: FavoriteColor = { hex, alpha };
          if (!validated.some((v) => isSameFavorite(v, entry))) {
            validated.push(entry);
          }
        }
      }
    }
    return validated.length > 0 ? validated : DEFAULT_FAVORITES;
  } catch {
    return DEFAULT_FAVORITES;
  }
}

/**
 * Saves favorite colors list to storage
 */
export function saveFavorites(favorites: FavoriteColor[], customStorage?: Storage): boolean {
  try {
    const storage = customStorage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!storage) return false;
    storage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favorites));
    return true;
  } catch {
    return false;
  }
}

/**
 * Adds a color to favorites if not already present. Preserves exact RGBA values.
 */
export function addFavoriteColor(
  favorites: FavoriteColor[],
  color: { hex: string; alpha: number },
  customStorage?: Storage
): { updated: FavoriteColor[]; added: boolean } {
  const normHex = normalizeHex(color.hex);
  if (!normHex) return { updated: favorites, added: false };

  const alpha = Math.max(0, Math.min(255, Math.round(color.alpha)));
  const newFav: FavoriteColor = { hex: normHex, alpha };

  // Check for duplicate
  if (favorites.some((f) => isSameFavorite(f, newFav))) {
    return { updated: favorites, added: false };
  }

  const updated = [...favorites, newFav];
  saveFavorites(updated, customStorage);
  return { updated, added: true };
}

/**
 * Removes a favorite color by index and persists changes
 */
export function removeFavoriteColor(
  favorites: FavoriteColor[],
  index: number,
  customStorage?: Storage
): FavoriteColor[] {
  if (index < 0 || index >= favorites.length) return favorites;
  const updated = favorites.filter((_, idx) => idx !== index);
  saveFavorites(updated, customStorage);
  return updated;
}
