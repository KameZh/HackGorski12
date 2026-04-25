import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    username: { type: String, default: "Anonymous" },
    accuracy: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" },
  },
  { timestamps: true },
);

const trailMarkSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    description: { type: String, default: "" },
    colourType: {
      type: String,
      enum: ["red", "blue", "green", "yellow", "white", "black", "unmarked"],
      default: "red",
    },
    startIndex: { type: Number, required: true, min: 0 },
    endIndex: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const trailSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: ["user", "osm", "osm_featured"],
      default: "user",
      index: true,
    },
    osm_id: { type: String, default: "", index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, default: "" },
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
    equipment: { type: String, default: "" },
    resources: { type: String, default: "" },
    startPoint: { type: String, default: "" },
    endPoint: { type: String, default: "" },
    highestPoint: { type: String, default: "" },
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
    mapGeometry: { type: Object, default: null },
    stats: {
      distance: Number,
      elevationGain: Number,
      duration: Number,
      pointCount: Number,
      centerCoordinates: [Number],
      startCoordinates: [Number],
      endCoordinates: [Number],
    },
    trailMarks: {
      type: [trailMarkSchema],
      default: [],
    },
    reviews: [reviewSchema],
    averageAccuracy: { type: Number, default: 0 },
    ai: {
      status: {
        type: String,
        enum: ["pending", "processing", "done", "error"],
        default: "pending",
      },
      segments: [
        {
          name: String,
          difficulty: {
            type: String,
            enum: ["easy", "moderate", "hard", "extreme"],
          },
          description: String,
          estimatedTime: String,
          startIndex: Number,
          endIndex: Number,
        },
      ],
      warnings: [
        {
          type_: String,
          description: String,
          severity: { type: String, enum: ["low", "medium", "high"] },
        },
      ],
      summary: String,
      overallDifficulty: String,
      error: String,
    },
  },
  { timestamps: true },
);

trailSchema.methods.recalcAverageAccuracy = function () {
  if (!this.reviews.length) {
    this.averageAccuracy = 0;
    return;
  }
  const sum = this.reviews.reduce((acc, r) => acc + r.accuracy, 0);
  this.averageAccuracy = Math.round((sum / this.reviews.length) * 10) / 10;
};

const Trail = mongoose.model("Trail", trailSchema);
export default Trail;
