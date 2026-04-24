const TRAIL_MARK_COLOURS = new Set([
  "red",
  "blue",
  "green",
  "yellow",
  "white",
  "black",
  "unmarked",
]);

const TRAIL_MARK_LABELS = {
  red: "Red",
  blue: "Blue",
  green: "Green",
  yellow: "Yellow",
  white: "White",
  black: "Black",
  unmarked: "Unmarked",
};

const FEATURED_REFS = new Set(["E3", "E4", "E8"]);

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeRefTokens(value) {
  return normalizeString(value)
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function distanceKmFromStats(stats) {
  const distanceMeters = Number(stats?.distance);
  return Number.isFinite(distanceMeters) && distanceMeters > 0
    ? distanceMeters / 1000
    : 0;
}

export function isFeaturedOfficialTrail({ ref = "", name = "", name_bg = "", name_en = "" } = {}) {
  const refTokens = normalizeRefTokens(ref);
  if (refTokens.some((token) => FEATURED_REFS.has(token))) return true;

  const joinedName = [name, name_bg, name_en]
    .map((value) => normalizeString(value).toLowerCase())
    .join(" ");
  const hasKomEmineName =
    (joinedName.includes("ком") && joinedName.includes("емине")) ||
    (joinedName.includes("kom") && joinedName.includes("emine"));

  return hasKomEmineName && refTokens.includes("KE");
}

export function inferOfficialTrailDifficulty({
  stats,
  network = "",
  ref = "",
  name = "",
  name_bg = "",
  name_en = "",
} = {}) {
  const distanceKm = distanceKmFromStats(stats);
  const elevationGain = Number(stats?.elevationGain || 0);

  if (
    distanceKm >= 80 ||
    (distanceKm >= 50 && isFeaturedOfficialTrail({ ref, name, name_bg, name_en }))
  ) {
    return "extreme";
  }

  let score = 0;
  if (distanceKm >= 30) score += 4;
  else if (distanceKm >= 18) score += 3;
  else if (distanceKm >= 9) score += 2;
  else if (distanceKm >= 4) score += 1;

  if (elevationGain >= 1800) score += 4;
  else if (elevationGain >= 1000) score += 3;
  else if (elevationGain >= 550) score += 2;
  else if (elevationGain >= 250) score += 1;

  const networkValue = normalizeString(network).toLowerCase();
  if (["iwn", "nwn"].includes(networkValue) && distanceKm >= 12) score += 1;

  if (score >= 6) return "extreme";
  if (score >= 4) return "hard";
  if (score >= 2) return "moderate";
  return "easy";
}

export function extractTrailCoordinates(geojson) {
  if (!geojson) return [];
  if (geojson.type === "LineString") return geojson.coordinates || [];
  if (geojson.type === "MultiLineString") {
    return Array.isArray(geojson.coordinates)
      ? geojson.coordinates.flat()
      : [];
  }
  if (geojson.type === "Feature") return extractTrailCoordinates(geojson.geometry);
  if (geojson.type === "FeatureCollection") {
    return Array.isArray(geojson.features)
      ? geojson.features.flatMap((feature) =>
          extractTrailCoordinates(feature?.geometry),
        )
      : [];
  }
  return [];
}

export function deriveTrailPointLabels(geojson) {
  const coords = extractTrailCoordinates(geojson);
  if (!coords.length) return { startPoint: "", endPoint: "", highestPoint: "" };

  const fmt = (coord) => {
    const longitude = Number(coord?.[0]);
    const latitude = Number(coord?.[1]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return "";
    return `${Math.abs(latitude).toFixed(5)}°${latitude >= 0 ? "N" : "S"}, ${Math.abs(longitude).toFixed(5)}°${longitude >= 0 ? "E" : "W"}`;
  };

  const startPoint = fmt(coords[0]);
  const endPoint = fmt(coords[coords.length - 1]);

  let highest = null;
  for (const coord of coords) {
    const elevation = Number(coord?.[2]);
    if (Number.isFinite(elevation) && (highest === null || elevation > highest)) {
      highest = elevation;
    }
  }

  return {
    startPoint,
    endPoint,
    highestPoint: highest === null ? "" : `${Math.round(highest)} m`,
  };
}

export function buildDefaultTrailMarks({
  geojson,
  colourType = "unmarked",
  osmColour = "",
  osmMarking = "",
} = {}) {
  const coords = extractTrailCoordinates(geojson);
  const maxIndex = coords.length - 1;
  if (maxIndex < 1) return [];

  const normalizedColour = String(colourType || "")
    .trim()
    .toLowerCase();
  const safeColour = TRAIL_MARK_COLOURS.has(normalizedColour)
    ? normalizedColour
    : "unmarked";
  const label = TRAIL_MARK_LABELS[safeColour] || "Marked";
  const sourceNote = [osmColour, osmMarking]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" / ");

  return [
    {
      name: `${label} marking`,
      description: sourceNote
        ? `Imported from OSM marking data: ${sourceNote}`
        : "Imported from OSM marking data.",
      colourType: safeColour,
      startIndex: 0,
      endIndex: maxIndex,
    },
  ];
}
