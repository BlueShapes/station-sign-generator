export interface Company {
  id: string;
  name: string;
  company_color: string;
}

export interface Line {
  id: string;
  company_id: string | null;
  name: string;
  line_color: string;
  prefix: string;
  priority: number | null;
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

export interface StationArea {
  id: string;
  station_id: string;
  name: string;
  is_white: number;
  sort_order: number;
}
