/**
 * Normaliza string para busca: lowercase + remove diacríticos (acentos).
 * Ex.: "Bíblia Sagrada" -> "biblia sagrada"
 */
export const normalizeSearch = (s: string | null | undefined): string =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Verifica se `haystack` contém `needle` ignorando caixa e acentos.
 */
export const matchesSearch = (
  haystack: string | null | undefined,
  needle: string | null | undefined
): boolean => {
  const q = normalizeSearch(needle).trim();
  if (!q) return true;
  return normalizeSearch(haystack).includes(q);
};
