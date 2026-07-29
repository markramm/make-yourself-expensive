/**
 * Shared localStorage read/write wrapper that stamps a schema_version alongside the data,
 * so a future shape change (new Profile field, a ProgressMap key rename, etc.) has something
 * to detect and migrate against instead of silently misreading old-shaped data as if it
 * matched the current shape.
 *
 * Each store defines its own CURRENT_VERSION and a migrate() chain; this module only handles
 * the read/write/wrap-unwrap mechanics.
 */

export interface VersionedRecord<T> {
  schema_version: number;
  data: T;
}

export interface Migration<T> {
  /** The schema_version this migration upgrades FROM. */
  from: number;
  migrate: (data: unknown) => T;
}

/**
 * Walks a chain of migrations from fromVersion up to targetVersion. Returns null if no
 * migration path exists (a gap in the chain) or if fromVersion is newer than targetVersion
 * (data from a future build this one doesn't know how to read) -- callers decide what to do
 * with null (fall back to a default for localStorage; surface an error for an import file).
 */
export function runMigrations<T>(
  data: unknown,
  fromVersion: number,
  targetVersion: number,
  migrations: Migration<T>[],
): T | null {
  if (fromVersion > targetVersion) return null;
  let current = data;
  let version = fromVersion;
  while (version < targetVersion) {
    const migration = migrations.find((m) => m.from === version);
    if (!migration) return null;
    current = migration.migrate(current);
    version += 1;
  }
  return current as T;
}

/**
 * Reads a versioned record from localStorage, running any needed migrations to bring it up
 * to currentVersion. Falls back to `fallback` if the key is missing, corrupt, or from a
 * schema_version newer than this build understands (better to reset than silently misread).
 */
export function loadVersioned<T>(
  key: string,
  currentVersion: number,
  fallback: T,
  migrations: Migration<T>[] = [],
): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);

    // Pre-versioning data (written before this wrapper existed) is a bare object with no
    // schema_version wrapper at all -- treat it as schema_version 0 rather than discarding it.
    const record: VersionedRecord<unknown> =
      parsed !== null && typeof parsed === 'object' && 'schema_version' in parsed
        ? (parsed as VersionedRecord<unknown>)
        : { schema_version: 0, data: parsed };

    const migrated = runMigrations<T>(record.data, record.schema_version, currentVersion, migrations);
    return migrated ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveVersioned<T>(key: string, currentVersion: number, data: T): void {
  if (typeof localStorage === 'undefined') return;
  const record: VersionedRecord<T> = { schema_version: currentVersion, data };
  localStorage.setItem(key, JSON.stringify(record));
}
