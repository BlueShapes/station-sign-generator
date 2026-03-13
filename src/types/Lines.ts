import type Platform from "@/types/StationProps";

interface Line {
  name: string;
  color: string;
  prefix: string;
  stations: Platform[];
}

export type { Line as default };
