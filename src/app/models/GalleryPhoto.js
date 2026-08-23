import mongoose from "mongoose";

const GalleryPhotoSchema = new mongoose.Schema({
  url:      { type: String, required: true },
  publicId: { type: String, default: null },
  order:    { type: Number, default: 0 },
  alt:      { type: String, default: null }, // texte alternatif SEO, saisi dans l'admin
}, { timestamps: true });

export default mongoose.models.GalleryPhoto || mongoose.model("GalleryPhoto", GalleryPhotoSchema);
