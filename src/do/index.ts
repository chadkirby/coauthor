/**
 * @ckirby/coauthor/do
 *
 * Cloudflare Durable Object SQLite register persistence and WebSocket hibernation utilities.
 */

import { mergeStamp, RegisterStamp, RegisterMap } from "../core/index.js";

export const COAUTHOR_SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS coauthor_registers (
  entity_id       TEXT NOT NULL,
  kind            TEXT NOT NULL,
  key             TEXT NOT NULL,
  rev             INTEGER NOT NULL,
  client_id       TEXT NOT NULL,
  schema_version  INTEGER NOT NULL,
  position        TEXT,
  display_text    TEXT,
  search_text     TEXT,
  value_json      TEXT,
  PRIMARY KEY (entity_id, kind, key)
);

CREATE INDEX IF NOT EXISTS idx_coauthor_registers_entity ON coauthor_registers(entity_id);

CREATE TABLE IF NOT EXISTS coauthor_handle_snapshots (
  entity_id       TEXT NOT NULL,
  base_rev        INTEGER NOT NULL,
  handles_json    TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  PRIMARY KEY (entity_id, base_rev)
);

CREATE TABLE IF NOT EXISTS coauthor_seq (
  library_seq     INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id       TEXT NOT NULL,
  committed_at    TEXT NOT NULL
);
`;

export interface RegisterRow {
  entity_id: string;
  kind: string;
  key: string;
  rev: number;
  client_id: string;
  schema_version: number;
  position: string | null;
  display_text: string | null;
  search_text: string | null;
  value_json: string | null;
}

/**
 * Applies a register patch in SQLite using last-write-wins semilattice rules.
 */
export function applyRegisterPatchInSqlite(
  sql: { exec: (query: string, ...params: unknown[]) => Iterable<Record<string, unknown>> },
  entityID: string,
  kind: string,
  patch: RegisterMap<unknown>,
  metadata?: { position?: string; displayText?: string; searchText?: string }
): { updatedCount: number } {
  let updatedCount = 0;

  for (const [key, incoming] of Object.entries(patch)) {
    const rows = Array.from(
      sql.exec(
        "SELECT rev, client_id, schema_version, value_json FROM coauthor_registers WHERE entity_id = ? AND kind = ? AND key = ?",
        entityID,
        kind,
        key
      )
    ) as unknown as { rev: number; client_id: string; schema_version: number; value_json: string | null }[];

    const existing: RegisterStamp<unknown> | undefined = rows[0]
      ? {
          rev: rows[0].rev,
          clientID: rows[0].client_id,
          schemaVersion: rows[0].schema_version,
          value: rows[0].value_json ? JSON.parse(rows[0].value_json) : null,
        }
      : undefined;

    const winner = mergeStamp(existing, incoming);

    if (!existing || winner !== existing) {
      sql.exec(
        `INSERT OR REPLACE INTO coauthor_registers (
          entity_id, kind, key, rev, client_id, schema_version, position, display_text, search_text, value_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        entityID,
        kind,
        key,
        winner.rev,
        winner.clientID,
        winner.schemaVersion,
        metadata?.position ?? null,
        metadata?.displayText ?? null,
        metadata?.searchText ?? null,
        winner.value !== null ? JSON.stringify(winner.value) : null
      );
      updatedCount++;
    }
  }

  return { updatedCount };
}
