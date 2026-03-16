const spacedStationName = (str: string) => {
  switch (str.length) {
    case 2:
      return str.split("").join("　");
    case 3:
      return str.split("").join(" ");
    default:
      return str;
  }
};

export default spacedStationName