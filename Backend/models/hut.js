import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    username: { type: String, default: "Anonymous" },
    comment: { type: String, default: "" },
  },
  { timestamps: true }
);

const hutSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    region: { type: String, default: "" },
    location: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: (v) => v && v.length === 2,
        message: "location must be [longitude, latitude]",
      },
      index: "2dsphere"
    },
    elevation: { type: Number, default: 0 },
    description: { type: String, default: "" },
    capacity: { type: String, default: "" },
    facilities: { type: String, default: "" },
    contacts: { type: String, default: "" },
    originPoints: { type: String, default: "" },
    neighbors: { type: String, default: "" },
    owner: { type: String, default: "" },
    reviews: [reviewSchema],
    averageRating: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Hut = mongoose.model("Hut", hutSchema);
export default Hut;
