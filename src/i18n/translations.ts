import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import path from 'node:path';

export function loadTranslations(locale: string): Record<string, unknown> {
  const filePath = path.resolve('src/locales', `${locale}.yml`);
  const fileContents = readFileSync(filePath, 'utf8');
  return parse(fileContents);
}
