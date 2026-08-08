import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { getRelativeLineDirectionAtStation } from "../src/db/repositories/through-routes.ts";

const wasmPath = fileURLToPath(
  new URL("../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url),
);
const samplePath = fileURLToPath(
  new URL("../public/sample.sqlite", import.meta.url),
);

const SQL = await initSqlJs({ wasmBinary: readFileSync(wasmPath) });
const db = new SQL.Database(readFileSync(samplePath));

function route(lineId) {
  const statement = db.prepare(
    `SELECT l.name, l.prefix, l.line_color,
            COUNT(sl.id) AS station_count,
            MIN(sl.sort_order) AS first_number,
            MAX(sl.sort_order) AS last_number
     FROM lines l
     JOIN station_lines sl ON sl.line_id = l.id
     WHERE l.id = ?
     GROUP BY l.id`,
  );
  try {
    statement.bind([lineId]);
    if (!statement.step()) throw new Error(`Missing sample line: ${lineId}`);
    return statement.getAsObject();
  } finally {
    statement.free();
  }
}

function numberedLinesForStation(stationId) {
  const statement = db.prepare(
    `SELECT l.prefix, sn.value
     FROM station_lines sl
     JOIN lines l ON l.id = sl.line_id
     JOIN station_numbers sn
       ON sn.station_id = sl.station_id AND sn.line_id = sl.line_id
     WHERE sl.station_id = ?
     ORDER BY l.prefix`,
  );
  try {
    statement.bind([stationId]);
    const lines = [];
    while (statement.step()) lines.push(statement.getAsObject());
    return lines;
  } finally {
    statement.free();
  }
}

function servicesForLine(lineId) {
  const statement = db.prepare(
    `SELECT id, name, color, sort_order
     FROM services
     WHERE line_id = ?
     ORDER BY sort_order`,
  );
  try {
    statement.bind([lineId]);
    const services = [];
    while (statement.step()) services.push(statement.getAsObject());
    return services;
  } finally {
    statement.free();
  }
}

function stopsForService(serviceId) {
  const statement = db.prepare(
    `SELECT CAST(sn.value AS INTEGER) AS number, sss.status
     FROM station_service_stops sss
     JOIN services svc ON svc.id = sss.service_id
     JOIN station_numbers sn
       ON sn.station_id = sss.station_id AND sn.line_id = svc.line_id
     WHERE sss.service_id = ?
     ORDER BY CAST(sn.value AS INTEGER)`,
  );
  try {
    statement.bind([serviceId]);
    const stops = [];
    while (statement.step()) stops.push(statement.getAsObject());
    return stops;
  } finally {
    statement.free();
  }
}

function stopNumbers(serviceId) {
  return stopsForService(serviceId).map(({ number }) => number);
}

function throughRouteSegments(routeId) {
  const statement = db.prepare(
    `SELECT tr.name, trs.line_id, trs.entry_station_id,
            trs.exit_station_id, trs.direction, trs.sort_order
     FROM through_routes tr
     JOIN through_route_segments trs ON trs.through_route_id = tr.id
     WHERE tr.id = ?
     ORDER BY trs.sort_order`,
  );
  try {
    statement.bind([routeId]);
    const segments = [];
    while (statement.step()) segments.push(statement.getAsObject());
    return segments;
  } finally {
    statement.free();
  }
}

describe("through-service sample routes", () => {
  test("contains the four requested complete lines", () => {
    expect(route("line-chuo-rapid")).toMatchObject({
      name: "中央線快速",
      prefix: "JC",
      line_color: "#f15a22",
      station_count: 24,
      first_number: 1,
      last_number: 24,
    });
    expect(route("line-chuo-sobu-local")).toMatchObject({
      name: "中央・総武線各駅停車",
      prefix: "JB",
      line_color: "#ffd400",
      station_count: 39,
      first_number: 1,
      last_number: 39,
    });
    expect(route("line-tozai")).toMatchObject({
      name: "東西線",
      prefix: "T",
      line_color: "#00a7db",
      station_count: 23,
      first_number: 1,
      last_number: 23,
    });
    expect(route("line-toyo-rapid")).toMatchObject({
      name: "東葉高速線",
      prefix: "TR",
      line_color: "#78e900",
      station_count: 9,
      first_number: 1,
      last_number: 9,
    });
  });

  test("reuses Nakano as the western connection point", () => {
    expect(numberedLinesForStation("station-jc06")).toEqual([
      { prefix: "JB", value: "07" },
      { prefix: "JC", value: "06" },
      { prefix: "T", value: "01" },
    ]);
  });

  test("reuses Nishi-funabashi as the eastern branch point", () => {
    expect(numberedLinesForStation("station-jb30")).toEqual([
      { prefix: "JB", value: "30" },
      { prefix: "T", value: "23" },
      { prefix: "TR", value: "01" },
    ]);
  });

  test("contains the Chuo Line rapid service patterns", () => {
    expect(servicesForLine("line-chuo-rapid").map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "svc-jc-kaisoku", name: "快速" },
      { id: "svc-jc-tsukin-kaisoku", name: "通勤快速" },
      { id: "svc-jc-chuo-tokkai", name: "中央特快" },
      { id: "svc-jc-tsukin-tokkai", name: "通勤特別快速" },
    ]);

    expect(stopNumbers("svc-jc-tsukin-kaisoku")).toEqual([
      1, 2, 3, 4, 5, 6, 9, 11, 12, 16, 19, 20, 21, 22, 23, 24,
    ]);
    expect(stopNumbers("svc-jc-chuo-tokkai")).toEqual([
      1, 2, 3, 4, 5, 6, 12, 16, 19, 20, 21, 22, 23, 24,
    ]);
    expect(stopNumbers("svc-jc-tsukin-tokkai")).toEqual([
      1, 2, 3, 4, 5, 16, 19, 20, 21, 22, 23, 24,
    ]);
    expect(
      stopsForService("svc-jc-kaisoku")
        .filter(({ status }) => status === "special")
        .map(({ number }) => number),
    ).toEqual([7, 8, 10]);
  });

  test("contains the Tokyo Metro Tozai Line service patterns", () => {
    expect(servicesForLine("line-tozai").map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "svc-t-kakueki", name: "各駅停車" },
      { id: "svc-t-kaisoku", name: "快速" },
      { id: "svc-t-tsukin-kaisoku", name: "通勤快速" },
    ]);
    expect(stopNumbers("svc-t-kakueki")).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
    expect(stopNumbers("svc-t-kaisoku")).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 18, 23,
    ]);
    expect(stopNumbers("svc-t-tsukin-kaisoku")).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 23,
    ]);
  });

  test("contains all-stations service patterns for the Toyo Rapid Line", () => {
    const services = servicesForLine("line-toyo-rapid");
    expect(services.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "svc-tr-kakueki", name: "各駅停車" },
      { id: "svc-tr-kaisoku", name: "快速" },
      { id: "svc-tr-tsukin-kaisoku", name: "通勤快速" },
    ]);
    for (const { id } of services) {
      expect(stopNumbers(id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  });

  test("keeps Chuo-Sobu Line local without separate service types", () => {
    expect(servicesForLine("line-chuo-sobu-local")).toEqual([]);
  });

  test("stores both directions of the Tozai through route as oriented sections", () => {
    expect(throughRouteSegments("through-mitaka-to-toyo-katsutadai")).toEqual([
      {
        name: "三鷹 → 東葉勝田台（東西線直通）",
        line_id: "line-chuo-sobu-local",
        entry_station_id: "station-jc12",
        exit_station_id: "station-jc06",
        direction: "forward",
        sort_order: 0,
      },
      {
        name: "三鷹 → 東葉勝田台（東西線直通）",
        line_id: "line-tozai",
        entry_station_id: "station-jc06",
        exit_station_id: "station-jb30",
        direction: "forward",
        sort_order: 1,
      },
      {
        name: "三鷹 → 東葉勝田台（東西線直通）",
        line_id: "line-toyo-rapid",
        entry_station_id: "station-jb30",
        exit_station_id: "station-tr09",
        direction: "forward",
        sort_order: 2,
      },
    ]);
    expect(
      throughRouteSegments("through-toyo-katsutadai-to-mitaka").map(
        ({ line_id, direction }) => ({ line_id, direction }),
      ),
    ).toEqual([
      { line_id: "line-toyo-rapid", direction: "reverse" },
      { line_id: "line-tozai", direction: "reverse" },
      { line_id: "line-chuo-sobu-local", direction: "reverse" },
    ]);
  });

  test("aligns adjacent lines for route-input station signs", () => {
    expect(
      getRelativeLineDirectionAtStation(
        db,
        "line-chuo-rapid",
        "line-chuo-sobu-local",
        "station-jc08",
      ),
    ).toBe("reverse");
    expect(
      getRelativeLineDirectionAtStation(
        db,
        "line-chuo-sobu-local",
        "line-tozai",
        "station-jc06",
      ),
    ).toBe("forward");
    expect(
      getRelativeLineDirectionAtStation(
        db,
        "line-tozai",
        "line-toyo-rapid",
        "station-jb30",
      ),
    ).toBe("forward");
  });
});
