import type { Database } from "sql.js";
import type { Station, StationTransfer } from "@/db/types";

function normalizeStationPair(
  firstStationId: string,
  secondStationId: string,
): [string, string] {
  if (firstStationId === secondStationId) {
    throw new Error("A station cannot transfer to itself");
  }
  return firstStationId < secondStationId
    ? [firstStationId, secondStationId]
    : [secondStationId, firstStationId];
}

export function getAllStationTransfers(db: Database): StationTransfer[] {
  const statement = db.prepare(
    `SELECT id, station_a_id, station_b_id
     FROM station_transfers
     ORDER BY station_a_id, station_b_id`,
  );
  const transfers: StationTransfer[] = [];
  while (statement.step()) {
    transfers.push(statement.getAsObject() as unknown as StationTransfer);
  }
  statement.free();
  return transfers;
}

export function hasStationTransfer(
  db: Database,
  firstStationId: string,
  secondStationId: string,
): boolean {
  if (firstStationId === secondStationId) return true;
  const [stationAId, stationBId] = normalizeStationPair(
    firstStationId,
    secondStationId,
  );
  const statement = db.prepare(
    `SELECT 1
     FROM station_transfers
     WHERE station_a_id = ? AND station_b_id = ?
     LIMIT 1`,
  );
  statement.bind([stationAId, stationBId]);
  const found = statement.step();
  statement.free();
  return found;
}

export function getConnectingStations(
  db: Database,
  stationId: string,
): Station[] {
  const statement = db.prepare(
    `SELECT s.id, s.primary_name, s.primary_name_furigana, s.secondary_name,
            s.tertiary_name, s.quaternary_name, s.quinary_name, s.note,
            s.three_letter_code, s.sort_order
     FROM station_transfers transfer
     JOIN stations s
       ON s.id = CASE
         WHEN transfer.station_a_id = ? THEN transfer.station_b_id
         ELSE transfer.station_a_id
       END
     WHERE transfer.station_a_id = ? OR transfer.station_b_id = ?
     ORDER BY s.primary_name, s.id`,
  );
  statement.bind([stationId, stationId, stationId]);
  const stations: Station[] = [];
  while (statement.step()) {
    stations.push(statement.getAsObject() as unknown as Station);
  }
  statement.free();
  return stations;
}

export function getTransferLineIds(
  db: Database,
  stationId: string,
): string[] {
  const statement = db.prepare(
    `SELECT DISTINCT station_line.line_id
     FROM station_transfers transfer
     JOIN station_lines station_line
       ON station_line.station_id = CASE
         WHEN transfer.station_a_id = ? THEN transfer.station_b_id
         ELSE transfer.station_a_id
       END
     WHERE transfer.station_a_id = ? OR transfer.station_b_id = ?
     ORDER BY station_line.line_id`,
  );
  statement.bind([stationId, stationId, stationId]);
  const lineIds: string[] = [];
  while (statement.step()) {
    const row = statement.getAsObject() as { line_id: string };
    lineIds.push(row.line_id);
  }
  statement.free();
  return lineIds;
}

export function upsertStationTransfer(
  db: Database,
  transferId: string,
  firstStationId: string,
  secondStationId: string,
): void {
  const [stationAId, stationBId] = normalizeStationPair(
    firstStationId,
    secondStationId,
  );
  db.run(
    `INSERT INTO station_transfers (id, station_a_id, station_b_id)
     VALUES (?, ?, ?)
     ON CONFLICT (station_a_id, station_b_id) DO NOTHING`,
    [transferId, stationAId, stationBId],
  );
}

export function deleteStationTransfer(
  db: Database,
  firstStationId: string,
  secondStationId: string,
): void {
  const [stationAId, stationBId] = normalizeStationPair(
    firstStationId,
    secondStationId,
  );
  db.run(
    `DELETE FROM station_transfers
     WHERE station_a_id = ? AND station_b_id = ?`,
    [stationAId, stationBId],
  );
}
