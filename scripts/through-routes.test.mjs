import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import { parse } from "yaml";
import { SUPPORTED_LOCALE_CODES } from "../src/i18n/locales.ts";
import migrateV054toV060 from "../src/db/migrations/v0.5.4_to_v0.6.0.ts";
import {
  getAllThroughRoutes,
  getRelativeLineDirectionAtStation,
  getThroughRouteValidationIssues,
  getThroughRoutePath,
  getThroughRouteSegmentStationIds,
  getThroughRouteSegments,
  replaceThroughRouteSegments,
  upsertThroughRoute,
  validateThroughRouteSegments,
} from "../src/db/repositories/through-routes.ts";

const wasmPath = fileURLToPath(
  new URL("../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url),
);
const SQL = await initSqlJs({ wasmBinary: readFileSync(wasmPath) });

let db;

beforeEach(() => {
  db = new SQL.Database();
  db.run(`
    CREATE TABLE lines (
      id TEXT PRIMARY KEY,
      is_loop INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE stations (id TEXT PRIMARY KEY);
    CREATE TABLE station_lines (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL,
      line_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );
    CREATE TABLE station_transfers (
      id TEXT PRIMARY KEY,
      station_a_id TEXT NOT NULL,
      station_b_id TEXT NOT NULL,
      UNIQUE (station_a_id, station_b_id)
    );
  `);
  for (const id of [
    "a",
    "shared",
    "b",
    "c",
    "loop-1",
    "loop-2",
    "loop-3",
    "loop-4",
  ]) {
    db.run("INSERT INTO stations (id) VALUES (?)", [id]);
  }
  for (const [id, isLoop] of [
    ["line-a", 0],
    ["line-b", 0],
    ["line-transfer", 0],
    ["line-loop", 1],
  ]) {
    db.run("INSERT INTO lines (id, is_loop) VALUES (?, ?)", [id, isLoop]);
  }
  db.run(
    `INSERT INTO station_lines VALUES
      ('sl-a-1', 'a', 'line-a', 1),
      ('sl-a-2', 'shared', 'line-a', 2),
      ('sl-b-1', 'b', 'line-b', 1),
      ('sl-b-2', 'shared', 'line-b', 2),
      ('sl-b-3', 'c', 'line-b', 3),
      ('sl-transfer-1', 'b', 'line-transfer', 1),
      ('sl-transfer-2', 'c', 'line-transfer', 2),
      ('sl-loop-1', 'loop-1', 'line-loop', 1),
      ('sl-loop-2', 'loop-2', 'line-loop', 2),
      ('sl-loop-3', 'loop-3', 'line-loop', 3),
      ('sl-loop-4', 'loop-4', 'line-loop', 4)`,
  );
});

afterEach(() => db.close());

describe("through route migration", () => {
  test("converts the unreleased start/end format and is idempotent", () => {
    db.run(`
      CREATE TABLE through_routes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE through_route_segments (
        id TEXT PRIMARY KEY,
        through_route_id TEXT NOT NULL,
        line_id TEXT NOT NULL,
        line_start_station_id TEXT NOT NULL,
        line_end_station_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
    `);
    db.run(
      "INSERT INTO through_routes (id, name, sort_order) VALUES ('route-1', 'Route', 0)",
    );
    db.run(`
      INSERT INTO through_route_segments
        (id, through_route_id, line_id, line_start_station_id,
         line_end_station_id, direction, sort_order)
      VALUES
        ('segment-1', 'route-1', 'line-a', 'a', 'shared', 'forward', 0),
        ('segment-2', 'route-1', 'line-b', 'b', 'shared', 'reverse', 1)
    `);

    migrateV054toV060(db);
    migrateV054toV060(db);

    const columns = db.exec(
      "PRAGMA table_info(through_route_segments)",
    )[0].values.map((row) => row[1]);
    expect(columns).toEqual([
      "id",
      "through_route_id",
      "line_id",
      "entry_station_id",
      "exit_station_id",
      "direction",
      "sort_order",
    ]);
    expect(
      db.exec(`
        SELECT id, entry_station_id, exit_station_id, direction
        FROM through_route_segments
        ORDER BY sort_order
      `)[0].values,
    ).toEqual([
      ["segment-1", "a", "shared", "forward"],
      ["segment-2", "shared", "b", "reverse"],
    ]);
  });
});

describe("through route translations", () => {
  test("defines every editor label in every supported locale", () => {
    const expectedKeys = [
      "title",
      "add",
      "edit",
      "name",
      "empty",
      "segments",
      "segment-number",
      "add-segment",
      "line",
      "entry-station",
      "exit-station",
      "direction",
      "forward",
      "reverse",
      "guide-title",
      "guide-intro",
      "guide-section",
      "guide-direction",
      "guide-connection",
      "delete-confirm",
      "service-help",
      "service-editor-help",
      "error-incomplete",
      "error-empty",
      "error-station-not-on-line",
      "error-invalid-direction",
      "error-disconnected",
      "error-same-station",
      "error-invalid-direction-detail",
      "error-disconnected-detail",
    ];
    for (const locale of SUPPORTED_LOCALE_CODES) {
      const messages = parse(
        readFileSync(`src/locales/${locale}.yml`, "utf8"),
      ).route?.["through-route"];
      expect(Object.keys(messages ?? {}).sort()).toEqual([...expectedKeys].sort());
      expect(messages["segment-number"]).toContain("{number}");
      expect(messages["service-editor-help"]).toContain("{name}");
    }
  });
});

describe("through route repository", () => {
  const route = { id: "route-1", name: "Test route", sort_order: 0 };
  const forward = {
    id: "segment-1",
    through_route_id: route.id,
    line_id: "line-a",
    entry_station_id: "a",
    exit_station_id: "shared",
    direction: "forward",
    sort_order: 0,
  };
  const reverse = {
    id: "segment-2",
    through_route_id: route.id,
    line_id: "line-b",
    entry_station_id: "shared",
    exit_station_id: "b",
    direction: "reverse",
    sort_order: 1,
  };

  beforeEach(() => {
    migrateV054toV060(db);
  });

  test("stores a connected route containing a reversed line section", () => {
    upsertThroughRoute(db, route);
    replaceThroughRouteSegments(db, route.id, [forward, reverse]);

    expect(getAllThroughRoutes(db)).toEqual([route]);
    expect(getThroughRouteSegments(db, route.id)).toEqual([forward, reverse]);
  });

  test("resolves a branch-free render path with one line per station gap", () => {
    upsertThroughRoute(db, route);
    replaceThroughRouteSegments(db, route.id, [forward, reverse]);

    expect(getThroughRoutePath(db, route.id)).toEqual({
      stationIds: ["a", "shared", "b"],
      edgeLineIds: ["line-a", "line-b"],
      lineIds: ["line-a", "line-b"],
    });
  });

  test("orients adjacent lines using their through-route segment directions", () => {
    upsertThroughRoute(db, route);
    replaceThroughRouteSegments(db, route.id, [forward, reverse]);

    expect(
      getRelativeLineDirectionAtStation(
        db,
        "line-a",
        "line-b",
        "shared",
      ),
    ).toBe("reverse");
    expect(
      getRelativeLineDirectionAtStation(
        db,
        "line-b",
        "line-a",
        "shared",
      ),
    ).toBe("reverse");
  });

  test("rejects disconnected and wrong-way non-loop sections", () => {
    expect(
      validateThroughRouteSegments(db, [
        forward,
        {
          ...reverse,
          entry_station_id: "b",
          exit_station_id: "shared",
          direction: "forward",
        },
      ]),
    ).toBe("disconnected");
    expect(
      validateThroughRouteSegments(db, [
        {
          ...forward,
          entry_station_id: "shared",
          exit_station_id: "a",
        },
      ]),
    ).toBe("invalid-direction");
  });

  test("identifies every affected section for editor feedback", () => {
    expect(
      getThroughRouteValidationIssues(db, [
        { ...forward, entry_station_id: "shared", exit_station_id: "a" },
        {
          ...reverse,
          entry_station_id: "b",
          exit_station_id: "shared",
          direction: "forward",
        },
      ]),
    ).toEqual([
      { error: "invalid-direction", segmentIndex: 0 },
      {
        error: "disconnected",
        segmentIndex: 1,
        previousSegmentIndex: 0,
      },
    ]);
  });

  test("connects distinct station records linked by an explicit transfer", () => {
    db.run(
      "INSERT INTO station_transfers VALUES ('transfer-1', 'b', 'shared')",
    );
    upsertThroughRoute(db, route);
    const transferred = {
      ...reverse,
      line_id: "line-transfer",
      entry_station_id: "b",
      exit_station_id: "c",
      direction: "forward",
    };

    expect(validateThroughRouteSegments(db, [forward, transferred])).toBeNull();
    replaceThroughRouteSegments(db, route.id, [forward, transferred]);
    expect(getThroughRoutePath(db, route.id)).toEqual({
      stationIds: ["a", "shared", "c"],
      stationIdGroups: [["a"], ["shared", "b"], ["c"]],
      edgeLineIds: ["line-a", "line-transfer"],
      lineIds: ["line-a", "line-transfer"],
    });
  });

  test("connects Marunouchi and Yamanote Ikebukuro in the sample data", () => {
    const sampleDb = new SQL.Database(readFileSync("public/sample.sqlite"));
    try {
      const sampleRoute = {
        id: "sample-ikebukuro-route",
        name: "Ikebukuro boundary",
        sort_order: 999,
      };
      const sampleSegments = [
        {
          id: "sample-m",
          through_route_id: sampleRoute.id,
          line_id: "line-marunouchi",
          entry_station_id: "station-m24",
          exit_station_id: "station-m25",
          direction: "forward",
          sort_order: 0,
        },
        {
          id: "sample-jy",
          through_route_id: sampleRoute.id,
          line_id: "line-yamanote",
          entry_station_id: "station-jy13",
          exit_station_id: "station-jy14",
          direction: "forward",
          sort_order: 1,
        },
      ];

      expect(validateThroughRouteSegments(sampleDb, sampleSegments)).toBeNull();
      upsertThroughRoute(sampleDb, sampleRoute);
      replaceThroughRouteSegments(sampleDb, sampleRoute.id, sampleSegments);
      expect(getThroughRoutePath(sampleDb, sampleRoute.id)).toEqual({
        stationIds: ["station-m24", "station-m25", "station-jy14"],
        stationIdGroups: [
          ["station-m24"],
          ["station-m25", "station-jy13"],
          ["station-jy14"],
        ],
        edgeLineIds: ["line-marunouchi", "line-yamanote"],
        lineIds: ["line-marunouchi", "line-yamanote"],
      });
    } finally {
      sampleDb.close();
    }
  });

  test("wraps across a loop boundary and direction selects the arc", () => {
    const loopSegment = {
      ...forward,
      line_id: "line-loop",
      entry_station_id: "loop-4",
      exit_station_id: "loop-2",
    };

    expect(validateThroughRouteSegments(db, [loopSegment])).toBeNull();
    expect(getThroughRouteSegmentStationIds(db, loopSegment)).toEqual([
      "loop-4",
      "loop-1",
      "loop-2",
    ]);

    const reverseLoopSegment = { ...loopSegment, direction: "reverse" };
    expect(validateThroughRouteSegments(db, [reverseLoopSegment])).toBeNull();
    expect(getThroughRouteSegmentStationIds(db, reverseLoopSegment)).toEqual([
      "loop-4",
      "loop-3",
      "loop-2",
    ]);
  });

  test("rejects a zero-length loop section", () => {
    expect(
      validateThroughRouteSegments(db, [
        {
          ...forward,
          line_id: "line-loop",
          entry_station_id: "loop-1",
          exit_station_id: "loop-1",
        },
      ]),
    ).toBe("invalid-direction");
  });
});
