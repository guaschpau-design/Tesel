// The names of the files the app saves for a group: its report and its backup copy.

/**
 * A file name that sorts by date and says which group: "tesel-equipo-turia-2026-10-26.txt", or
 * "tesel-2026-10-26.txt" for a name with no letters or digits.
 */
export function fileName(group: string, now: number, extension: string): string {
  const slug = group
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const date = new Date(now).toISOString().slice(0, 10);
  return ['tesel', slug, date].filter(Boolean).join('-') + `.${extension}`;
}
