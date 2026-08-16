import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { getConnectingStations } from "../src/db/repositories/station-transfers.ts";
import {
  getAllStations,
  getResolvedStationNumber,
  getStationLines,
} from "../src/db/repositories/stations.ts";
import { getSelectedStationNumberThreeLetterCode } from "../src/components/tabs/routeStationNumberSelection.ts";

const wasmPath = fileURLToPath(
  new URL("../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url),
);
const samplePath = fileURLToPath(
  new URL("../public/sample.sqlite", import.meta.url),
);
const SQL = await initSqlJs({ wasmBinary: readFileSync(wasmPath) });

describe("route-input station-number three-letter codes", () => {
  test("resolves SJK from the JR station connected to Marunouchi M08", () => {
    const db = new SQL.Database(readFileSync(samplePath));
    try {
      const stationIds = [
        "station-m08",
        ...getConnectingStations(db, "station-m08").map(({ id }) => id),
      ];
      const jrStationId = stationIds.find((stationId) =>
        getStationLines(db, stationId).some(
          ({ line_id }) => line_id === "line-yamanote",
        ),
      );
      expect(jrStationId).toBe("station-jy17");

      const number = getResolvedStationNumber(
        db,
        jrStationId,
        "line-yamanote",
      );
      const station = getAllStations(db).find(({ id }) => id === jrStationId);
      expect(
        getSelectedStationNumberThreeLetterCode([
          {
            stationNumberStyle: number?.station_number_style ?? "",
            threeLetterCode: station?.three_letter_code,
          },
        ]),
      ).toBe("SJK");
    } finally {
      db.close();
    }
  });
});
