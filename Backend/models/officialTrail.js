import mongoose from "mongoose";

const officialTrailSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: ["osm", "osm_featured"],
      default: "osm",
      index: true,
    },
    osm_id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    ref: { type: String, default: "" },
    name_bg: { type: String, default: "" },
    name_en: { type: String, default: "" },
    region: { type: String, default: "" },
    difficulty: {
      type: String,
      enum: ["easy", "moderate", "hard", "extreme"],
      default: "moderate",
    },
    osm_colour: { type: String, default: "" },
    osm_marking: { type: String, default: "" },
    colour_type: {
      type: String,
      enum: ["red", "blue", "green", "yellow", "white", "black", "unmarked"],
      default: "unmarked",
      index: true,
    },
    network: { type: String, default: "" },
    description: { type: String, default: "" },
    startCoordinates: {
      type: [Number],
      default: null,
      validate: {
        validator: (v) => !v || v.length === 2,
        message: "startCoordinates must be [longitude, latitude]",
      },
    },
    endCoordinates: {
      type: [Number],
      default: null,
      validate: {
        validator: (v) => !v || v.length === 2,
        message: "endCoordinates must be [longitude, latitude]",
      },
    },
    geojson: { type: Object, required: true },
    geom: { type: Object, default: null },
    stats: {
      distance: Number,
      elevationGain: Number,
      duration: Number,
      pointCount: Number,
      centerCoordinates: [Number],
      startCoordinates: [Number],
      endCoordinates: [Number],
    },
    averageAccuracy: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "official_trails",
  },
);

const OfficialTrail = mongoose.model("OfficialTrail", officialTrailSchema);
export default OfficialTrail;
