export type MetaModelDateFilter = 'all' | 'today' | 'week' | 'month' | 'year';

export type MetaModelSearchFilterKey =
  | 'name'
  | 'description'
  | 'domain'
  | 'keywords'
  | 'created';

export interface ParsedMetaModelSearchFilter {
  key: MetaModelSearchFilterKey;
  value: string;
}

export interface MetaModelFindFilters {
  name?: string;
  description?: string;
  domain?: string;
  keyword?: string[];
  createdFrom?: string;
  createdTo?: string;
  ownedByUser?: boolean;
}

const SEARCH_FILTER_KEYS: MetaModelSearchFilterKey[] = [
  'name',
  'description',
  'domain',
  'keywords',
  'created',
];

export const META_MODEL_SEARCH_TAB_COMPLETIONS = SEARCH_FILTER_KEYS;

export function parseMetaModelSearchQuery(query: string): ParsedMetaModelSearchFilter[] {
  const filters: ParsedMetaModelSearchFilter[] = [];
  for (const part of query.split(/\s+/).filter(Boolean)) {
    const match = /^([a-zA-Z]+):(.+)$/.exec(part);
    if (!match) continue;
    const [, rawKey, rawValue] = match;
    const key = rawKey.toLowerCase() as MetaModelSearchFilterKey;
    if (!SEARCH_FILTER_KEYS.includes(key)) continue;
    filters.push({ key, value: rawValue.replaceAll('"', '') });
  }
  return filters;
}

function parseDateFilterValue(value: string): { from?: string; to?: string } {
  const toIso = (input: string) =>
    input === 'now' ? new Date().toISOString() : new Date(input).toISOString();

  if (value.includes('after:')) {
    return { from: toIso(value.replace('after:', '')) };
  }
  if (value.includes('before:')) {
    return { to: toIso(value.replace('before:', '')) };
  }
  if (value.includes('between:')) {
    const [fromRaw, toRaw] = value.replace('between:', '').split('..');
    if (fromRaw && toRaw) {
      return {
        from: new Date(fromRaw).toISOString(),
        to: new Date(toRaw).toISOString(),
      };
    }
    return {};
  }
  return {
    from: new Date(value).toISOString(),
    to: new Date(`${value}T23:59:59`).toISOString(),
  };
}

function applyDatePreset(
  filters: MetaModelFindFilters,
  dateFilter: MetaModelDateFilter,
): void {
  if (dateFilter === 'all') return;

  const now = new Date();
  const fromByPreset: Record<Exclude<MetaModelDateFilter, 'all'>, Date> = {
    today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    month: new Date(now.getFullYear(), now.getMonth(), 1),
    year: new Date(now.getFullYear(), 0, 1),
  };

  filters.createdFrom = fromByPreset[dateFilter].toISOString();
  filters.createdTo = now.toISOString();
}

export function buildMetaModelFindFilters(
  searchQuery: string,
  parsedFilters: ParsedMetaModelSearchFilter[],
  dateFilter: MetaModelDateFilter,
  ownedByUser = false,
): MetaModelFindFilters {
  const filters: MetaModelFindFilters = { ownedByUser };
  const trimmed = searchQuery.trim();

  if (parsedFilters.length === 0 && trimmed && !trimmed.includes(':')) {
    filters.name = trimmed;
  }

  for (const entry of parsedFilters) {
    const value = entry.value.trim();
    if (!value) continue;

    if (entry.key === 'name' || entry.key === 'domain' || entry.key === 'description') {
      filters[entry.key] = value;
      continue;
    }

    if (entry.key === 'keywords') {
      filters.keyword = value.split(',').map(part => part.trim()).filter(Boolean);
      continue;
    }

    if (entry.key === 'created') {
      const { from, to } = parseDateFilterValue(value);
      if (from) filters.createdFrom = from;
      if (to) filters.createdTo = to;
    }
  }

  const hasExplicitDateFilter = parsedFilters.some(f => f.key === 'created');
  if (!hasExplicitDateFilter) {
    applyDatePreset(filters, dateFilter);
  }

  return filters;
}

export function appendMetaModelSearchToken(
  current: string,
  key: MetaModelSearchFilterKey,
  value: string,
): string {
  const token = `${key}:${value}`;
  return current.trim() ? `${current.trim()} ${token}` : token;
}

export function completeMetaModelSearchToken(
  value: string,
  caret: number,
): { nextValue: string; nextCaret: number } | null {
  let start = caret - 1;
  while (start >= 0 && !/\s/.test(value[start])) start -= 1;
  start += 1;
  let end = caret;
  while (end < value.length && !/\s/.test(value[end])) end += 1;

  const token = value.slice(start, end);
  const lower = token.toLowerCase().replace(/:$/, '');
  if (!lower) return null;

  const match = SEARCH_FILTER_KEYS.find(key => key.startsWith(lower));
  if (!match) return null;

  const replacement = `${match}:`;
  return {
    nextValue: value.slice(0, start) + replacement + value.slice(end),
    nextCaret: start + replacement.length,
  };
}
