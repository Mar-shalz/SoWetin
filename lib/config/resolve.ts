import { APP_CONFIG, type AppConfig } from './app.config';

export type ConfigRow = { key: string; value: unknown };

// An override must have the same JSON shape as its default: same type, and for objects every default key.
function sameShape(def: unknown, value: unknown): boolean {
  if (Array.isArray(def)) {
    if (!Array.isArray(value)) return false;
    const kind = def.length ? typeof def[0] : typeof value[0];
    return value.every((x) => typeof x === kind && (kind === 'string' || kind === 'number'));
  }
  if (def !== null && typeof def === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.entries(def).every(([k, d]) => sameShape(d, (value as Record<string, unknown>)[k]));
  }
  return typeof def === typeof value;
}

// Merges app_config rows over the defaults. A bad row is skipped and reported, never thrown,
// so one wrong admin edit can't take the app down (doc 06, section 7).
export function resolveConfig(rows: ConfigRow[], defaults: AppConfig = APP_CONFIG): { config: AppConfig; rejected: string[] } {
  const config: Record<string, unknown> = { ...defaults };
  const rejected: string[] = [];
  for (const { key, value } of rows) {
    if (!(key in defaults) || !sameShape(defaults[key as keyof AppConfig], value)) rejected.push(key);
    else config[key] = value;
  }
  return { config: config as AppConfig, rejected };
}
