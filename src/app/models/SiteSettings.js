import mongoose from "mongoose";

const SiteSettingsSchema = new mongoose.Schema(
  {
    maintenanceMode: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.SiteSettings ||
  mongoose.model("SiteSettings", SiteSettingsSchema);
