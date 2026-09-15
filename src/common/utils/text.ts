/** Normaliza texto para comparação de duplicados: sem acentos, minúsculas, espaços únicos. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Números de série são comparados sem espaços/hífens e em maiúsculas. */
export function normalizeSerial(value: string | null | undefined): string | null {
  const v = (value ?? '').replace(/[\s-]+/g, '').toUpperCase();
  return v.length > 0 ? v : null;
}

/** Remove espaços extra; devolve null para strings vazias. */
export function clean(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const v = String(value).replace(/\s+/g, ' ').trim();
  return v.length > 0 ? v : null;
}

/** Escapa os caracteres especiais do operador ILIKE. */
export function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
