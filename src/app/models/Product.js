import mongoose from "mongoose";

const VariantSchema = new mongoose.Schema({
  colorName:  { type: String, required: true },   // "Bleu"
  colorCode:  { type: String, required: true },   // "#1B2D5E"
  textColor:  { type: String, default: "#ffffff" }, // couleur du texte du bouton commander
  description: { type: String, default: "" }, // texte affiché sous le sélecteur de couleur sur la fiche produit
  image:      { type: String, default: "" },
}, { _id: true });

const ProductSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  price:      { type: Number, required: true, default: 85 },
  pricePromo: { type: Number, default: null },
  stock:      { type: Number, default: 0 },
  visible:    { type: Boolean, default: true },
  variants:   { type: [VariantSchema], default: [] },
  weight:     { type: Number, default: 100 }, // grammes — utilisé pour calculer le poids total des colis Chronopost
  customsDescriptionEn: { type: String, default: "" }, // description anglaise pour <content1> (envois internationaux)
}, { timestamps: true });

export default mongoose.models.Product || mongoose.model("Product", ProductSchema);
