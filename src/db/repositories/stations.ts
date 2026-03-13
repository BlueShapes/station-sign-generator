import type { Database } from "sql.js";
import type DirectInputStationProps from "@/components/signs/DirectInputStationProps";
import type { Direction } from "@/components/signs/DirectInputStationProps";

// Well-known IDs for the default single-session design
export const CURRENT_ID = "station-current";
export const LEFT_ID = "station-left";
export const RIGHT_ID = "station-right";
export const CONFIG_ID = "default";

function getNumbers(
  db: Database,
  stationId: string,
): { primary: string; secondary: string } {
  const stmt = db.prepare(
    `SELECT value, is_primary FROM station_numbers WHERE station_id = :sid`,
  );
  stmt.bind({ ":sid": stationId });

  let primary = "";
  let secondary = "";
  while (stmt.step()) {
    const row = stmt.getAsObject() as { value: string; is_primary: number };
    if (row.is_primary === 1) primary = row.value;
    else secondary = row.value;
  }
  stmt.free();
  return { primary, secondary };
}

function syncNumbers(
  db: Database,
  stationId: string,
  primary: string | undefined,
  secondary: string | undefined,
): void {
  db.run(`DELETE FROM station_numbers WHERE station_id = ?`, [stationId]);
  if (primary) {
    db.run(
      `INSERT INTO station_numbers (id, station_id, value, is_primary) VALUES (lower(hex(randomblob(16))), ?, ?, 1)`,
      [stationId, primary],
    );
  }
  if (secondary) {
    db.run(
      `INSERT INTO station_numbers (id, station_id, value, is_primary) VALUES (lower(hex(randomblob(16))), ?, ?, 0)`,
      [stationId, secondary],
    );
  }
}

function getAreas(
  db: Database,
  stationId: string,
): { id: string; name: string; isWhite: boolean }[] {
  const stmt = db.prepare(
    `SELECT id, name, is_white FROM station_areas WHERE station_id = :sid ORDER BY sort_order`,
  );
  stmt.bind({ ":sid": stationId });

  const areas: { id: string; name: string; isWhite: boolean }[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as {
      id: string;
      name: string;
      is_white: number;
    };
    areas.push({ id: row.id, name: row.name, isWhite: row.is_white === 1 });
  }
  stmt.free();
  return areas;
}

function syncAreas(
  db: Database,
  stationId: string,
  areas: { id: string; name: string; isWhite?: boolean }[] | undefined,
): void {
  db.run(`DELETE FROM station_areas WHERE station_id = ?`, [stationId]);
  if (!areas) return;
  areas.forEach((area, i) => {
    db.run(
      `INSERT INTO station_areas (id, station_id, name, is_white, sort_order) VALUES (?, ?, ?, ?, ?)`,
      [area.id, stationId, area.name, area.isWhite ? 1 : 0, i],
    );
  });
}

export function getSignConfig(db: Database): DirectInputStationProps | null {
  const stmt = db.prepare(`
    SELECT
      s.name              AS station_name,
      s.name_furigana     AS station_name_furigana,
      s.name_english      AS station_name_english,
      s.name_korean       AS station_name_korean,
      s.name_chinese      AS station_name_chinese,
      s.note              AS station_note,
      s.three_letter_code AS station_three_letter_code,
      sc.line_color,
      sc.base_color,
      sc.ratio,
      sc.direction,
      ls.name             AS left_name,
      ls.name_furigana    AS left_furigana,
      ls.name_english     AS left_english,
      rs.name             AS right_name,
      rs.name_furigana    AS right_furigana,
      rs.name_english     AS right_english
    FROM sign_configurations sc
    JOIN stations s ON sc.station_id = s.id
    LEFT JOIN adjacent_stations als
           ON als.station_id = s.id AND als.direction = 'left'
    LEFT JOIN stations ls ON als.adjacent_station_id = ls.id
    LEFT JOIN adjacent_stations ars
           ON ars.station_id = s.id AND ars.direction = 'right'
    LEFT JOIN stations rs ON ars.adjacent_station_id = rs.id
    WHERE sc.id = :id
    LIMIT 1
  `);
  stmt.bind({ ":id": CONFIG_ID });

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject() as Record<string, string | number | null>;
  stmt.free();

  const str = (v: string | number | null): string => (v as string) ?? "";

  const currentNums = getNumbers(db, CURRENT_ID);
  const leftNums = getNumbers(db, LEFT_ID);
  const rightNums = getNumbers(db, RIGHT_ID);
  const areas = getAreas(db, CURRENT_ID);

  return {
    primaryName: str(row["station_name"]),
    primaryNameFurigana: str(row["station_name_furigana"]),
    secondaryName: str(row["station_name_english"]),
    tertiaryName: str(row["station_name_korean"]),
    quaternaryName: str(row["station_name_chinese"]),
    note: str(row["station_note"]),
    threeLetterCode: str(row["station_three_letter_code"]),
    numberPrimary: currentNums.primary,
    numberSecondary: currentNums.secondary,
    stationAreas: areas,
    leftPrimaryName: str(row["left_name"]),
    leftPrimaryNameFurigana: str(row["left_furigana"]),
    leftSecondaryName: str(row["left_english"]),
    leftNumberPrimary: leftNums.primary,
    leftNumberSecondary: leftNums.secondary,
    rightPrimaryName: str(row["right_name"]),
    rightPrimaryNameFurigana: str(row["right_furigana"]),
    rightSecondaryName: str(row["right_english"]),
    rightNumberPrimary: rightNums.primary,
    rightNumberSecondary: rightNums.secondary,
    lineColor: str(row["line_color"]),
    baseColor: str(row["base_color"]),
    ratio: row["ratio"] as number,
    direction: str(row["direction"]) as Direction,
  };
}

export function saveSignConfig(
  db: Database,
  data: DirectInputStationProps,
): void {
  // Upsert the three station rows
  const upsertStation = (
    id: string,
    name: string,
    furigana: string | undefined,
    english: string,
    korean?: string,
    chinese?: string,
    note?: string,
    tlc?: string,
  ) => {
    db.run(
      `INSERT OR REPLACE INTO stations
         (id, name, name_furigana, name_english, name_korean, name_chinese, note, three_letter_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        furigana ?? null,
        english,
        korean ?? null,
        chinese ?? null,
        note ?? null,
        tlc ?? null,
      ],
    );
  };

  upsertStation(
    CURRENT_ID,
    data.primaryName,
    data.primaryNameFurigana,
    data.secondaryName,
    data.tertiaryName,
    data.quaternaryName,
    data.note,
    data.threeLetterCode,
  );
  upsertStation(
    LEFT_ID,
    data.leftPrimaryName,
    data.leftPrimaryNameFurigana,
    data.leftSecondaryName,
  );
  upsertStation(
    RIGHT_ID,
    data.rightPrimaryName,
    data.rightPrimaryNameFurigana,
    data.rightSecondaryName,
  );

  // Sync station numbers
  syncNumbers(db, CURRENT_ID, data.numberPrimary, data.numberSecondary);
  syncNumbers(db, LEFT_ID, data.leftNumberPrimary, data.leftNumberSecondary);
  syncNumbers(db, RIGHT_ID, data.rightNumberPrimary, data.rightNumberSecondary);

  // Sync station areas (current station only)
  syncAreas(db, CURRENT_ID, data.stationAreas);

  // Upsert adjacent_stations links
  const upsertAdjacent = (direction: "left" | "right", adjacentId: string) => {
    db.run(
      `INSERT OR REPLACE INTO adjacent_stations
         (id, station_id, adjacent_station_id, direction)
       VALUES (
         (SELECT id FROM adjacent_stations WHERE station_id = ? AND direction = ?),
         ?, ?, ?
       )`,
      [CURRENT_ID, direction, CURRENT_ID, adjacentId, direction],
    );
  };
  upsertAdjacent("left", LEFT_ID);
  upsertAdjacent("right", RIGHT_ID);

  // Upsert sign_configuration
  db.run(
    `INSERT OR REPLACE INTO sign_configurations
       (id, station_id, line_color, base_color, ratio, direction, sign_style)
     VALUES (?, ?, ?, ?, ?, ?, 'jreast')`,
    [
      CONFIG_ID,
      CURRENT_ID,
      data.lineColor,
      data.baseColor,
      data.ratio,
      data.direction ?? "left",
    ],
  );
}
