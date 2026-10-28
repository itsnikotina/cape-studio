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
      if (
        item &&
        typeof item === 'object' &&
        typeof item.hex === 'string' &&
        /^#[0-9A-Fa-f]{6}$/.test(item.hex) &&
        typeof item.alpha === 'number' &&
        item.alpha >= 0 &&
        item.alpha <= 255
      ) {
        validated.push({ hex: item.hex.toUpperCase(), alpha: Math.round(item.alpha) });
      }
    }
    return validated.length > 0 ? validated : DEFAULT_FAVORITES;
  } catch {
    return DEFAULT_FAVORITES;
  }
}
