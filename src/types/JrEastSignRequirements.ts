/**
 * JR East style data requirements from the database.
 *
 * This file declares which values from each DB table are needed to render a
 * JR East style station sign, and the upper bound of each array field.
 *
 * DB source columns are noted in JSDoc comments.
 */

/** Max number of station number badges per station position (primary + secondary) */
export const JREAST_MAX_NUMBERS = 2;

/** Max number of 特定都区市内 (fare area) badges on the sign */
export const JREAST_MAX_AREAS = 5;

/** Max adjacent stations shown per direction (only the immediate neighbor is shown) */
export const JREAST_MAX_ADJACENT = 1;

/**
 * One number badge entry, joining station_numbers + lines.
 *
 * - `prefix`    ← lines.prefix
 * - `value`     ← station_numbers.value
 * - `lineColor` ← lines.line_color  (determines badge border stroke color)
 */
export interface JrEastNumberBadge {
  prefix: string;
  value: string;
  lineColor: string;
}

/**
 * Data needed for the current station.
 *
 * - `primaryName`         ← stations.primary_name
 * - `primaryNameFurigana` ← stations.primary_name_furigana
 * - `secondaryName`       ← stations.secondary_name  (English)
 * - `tertiaryName`        ← stations.tertiary_name   (Korean)
 * - `quaternaryName`      ← stations.quaternary_name (Chinese)
 * - `note`                ← stations.note
 * - `threeLetterCode`     ← stations.three_letter_code
 * - `stationAreas`        ← station_areas (max: JREAST_MAX_AREAS)
 * - `numbers`             ← station_numbers JOIN lines (max: JREAST_MAX_NUMBERS)
 */
export interface JrEastCurrentStation {
  primaryName: string;
  primaryNameFurigana?: string;
  secondaryName?: string;
  tertiaryName?: string;
  quaternaryName?: string;
  note?: string;
  threeLetterCode?: string;
  stationAreas?: Array<{
    /** station_areas.name */
    name: string;
    /** station_areas.is_white */
    isWhite: boolean;
  }>;
  numbers?: JrEastNumberBadge[];
}

/**
 * Data needed for a left or right adjacent station.
 *
 * Source is the neighboring row in station_lines by sort_order.
 * Only primary name, English name, and number badges are shown.
 *
 * - `primaryName`  ← stations.primary_name
 * - `secondaryName`← stations.secondary_name (English)
 * - `numbers`      ← station_numbers JOIN lines (max: JREAST_MAX_NUMBERS)
 */
export interface JrEastAdjacentStation {
  primaryName: string;
  secondaryName?: string;
  numbers?: JrEastNumberBadge[];
}

/**
 * Complete data requirements for generating one JR East style sign.
 *
 * - `companyColor` ← companies.company_color  (main bar / triangle color)
 * - `left`         ← previous station in station_lines (max: JREAST_MAX_ADJACENT)
 * - `right`        ← next station in station_lines     (max: JREAST_MAX_ADJACENT)
 * - `config.ratio` ← current_sign_configurations.ratio
 * - `config.direction` ← current_sign_configurations.direction
 */
export interface JrEastSignRequirements {
  station: JrEastCurrentStation;
  left?: JrEastAdjacentStation[];
  right?: JrEastAdjacentStation[];
  /** companies.company_color */
  companyColor: string;
  config: {
    /** current_sign_configurations.ratio */
    ratio: number;
    /** current_sign_configurations.direction */
    direction: "left" | "right" | "both";
  };
}
