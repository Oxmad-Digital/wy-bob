import mongoose from "mongoose";

const SiteSettingsSchema = new mongoose.Schema(
  {
    maintenanceMode: { type: Boolean, default: false },
    billing: {
      companyName: { type: String, default: "" },
      legalForm: { type: String, default: "" },
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      postalCode: { type: String, default: "" },
      siret: { type: String, default: "" },
      vatNumber: { type: String, default: "" },
      vatApplicable: { type: Boolean, default: false },
      vatRate: { type: Number, default: 20 },
      iban: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

export default mongoose.models.SiteSettings ||
  mongoose.model("SiteSettings", SiteSettingsSchema);
