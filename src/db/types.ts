export interface Company {
  id: string;
  name: string;
  company_color: string;
  station_number_style: string;
}

export interface Line {
  id: string;
  company_id: string | null;
  name: string;
  line_color: string;
  prefix: string;
  priority: number | null;
  is_loop: number;
}

export interface Station {
  id: string;
  primary_name: string;
  primary_name_furigana: string | null;
  secondary_name: string | null;
  tertiary_name: string | null;
  quaternary_name: string | null;
  quinary_name: string | null;
  note: string | null;
  three_letter_code: string | null;
  sort_order: number | null;
}

export interface StationLine {
  id: string;
  station_id: string;
  line_id: string;
  sort_order: number;
}

export interface StationNumber {
  id: string;
  station_id: string;
  line_id: string;
  value: string;
}

export interface SpecialZone {
  id: string;
  name: string;
  abbreviation: string;
  is_black: number;
}

export interface StationArea {
  id: string;
  station_id: string;
  zone_id: string;
  sort_order: number;
}

export interface StationAreaWithZone {
  id: string;
  station_id: string;
  zone_id: string;
  sort_order: number;
  zone_name: string;
  zone_abbreviation: string;
  zone_is_black: number;
}
