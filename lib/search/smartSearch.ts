/**
 * Smart search utility for fuzzy matching station names
 *
 * Features:
 * - Ignores diacritics (e.g., "Praha" matches "Praha")
 * - Ignores spaces and dashes
 * - Supports shortcuts (e.g., "s n o" matches "Suchdol nad Odrou")
 * - Case insensitive
 */

/**
 * Remove diacritics from a string
 * e.g., "Střížkov" -> "Strizkov", "Würzburg" -> "Wurzburg"
 */
export function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalize a string for comparison:
 * - lowercase
 * - remove diacritics
 * - remove extra whitespace
 */
export function normalizeForSearch(str: string): string {
  return removeDiacritics(str).toLowerCase().trim();
}

/**
 * Normalize for compact comparison (removes all spaces/dashes)
 */
export function normalizeCompact(str: string): string {
  return normalizeForSearch(str).replace(/[\s\-]/g, '');
}

/**
 * Check if query matches text using shortcut matching
 * Each word/letter in query should match the start of words in text
 *
 * Examples:
 * - "s n o" matches "Suchdol nad Odrou"
 * - "phn" matches "Praha hlavní nádraží"
 * - "bud kel" matches "Budapest Keleti"
 */
function matchesShortcut(query: string, text: string): boolean {
  const normalizedText = normalizeForSearch(text);
  const textWords = normalizedText.split(/[\s\-]+/).filter(Boolean);

  // Split query by spaces to get query parts
  const queryParts = normalizeForSearch(query).split(/\s+/).filter(Boolean);

  if (queryParts.length === 0) return true;
  if (textWords.length === 0) return false;

  // Each query part must match the start of some word in text
  // Words should be matched in order (but can skip words)
  let textWordIndex = 0;

  for (const queryPart of queryParts) {
    let found = false;

    // Look for a word starting with this query part
    while (textWordIndex < textWords.length) {
      if (textWords[textWordIndex].startsWith(queryPart)) {
        found = true;
        textWordIndex++;
        break;
      }
      textWordIndex++;
    }

    if (!found) return false;
  }

  return true;
}

/**
 * Check if query matches text using contains matching (ignoring spaces/dashes)
 * e.g., "prahahl" matches "Praha hlavní nádraží"
 */
function matchesCompact(query: string, text: string): boolean {
  const normalizedQuery = normalizeCompact(query);
  const normalizedText = normalizeCompact(text);

  return normalizedText.includes(normalizedQuery);
}

/**
 * Check if query matches text using simple contains
 */
function matchesContains(query: string, text: string): boolean {
  const normalizedQuery = normalizeForSearch(query);
  const normalizedText = normalizeForSearch(text);

  return normalizedText.includes(normalizedQuery);
}

/**
 * Smart search that combines multiple matching strategies
 *
 * @param query - The search query
 * @param text - The text to search in
 * @returns true if query matches text
 */
export function smartMatch(query: string, text: string): boolean {
  if (!query.trim()) return true;
  if (!text) return false;

  // Try simple contains first (most intuitive)
  if (matchesContains(query, text)) return true;

  // Try compact matching (ignoring spaces/dashes)
  if (matchesCompact(query, text)) return true;

  // Try shortcut matching
  if (matchesShortcut(query, text)) return true;

  return false;
}

/**
 * Smart search for stations - matches against name and code
 */
export function smartMatchStation(
  query: string,
  station: { name: string; code: string }
): boolean {
  if (!query.trim()) return true;

  return smartMatch(query, station.name) || smartMatch(query, station.code);
}
