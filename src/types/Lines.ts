import Platform from "@/types/StationProps"

interface Line {
  name: string;
  color: string;
  prefix: string;
  stations: Platform[]
}

export default Line