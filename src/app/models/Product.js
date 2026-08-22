import mongoose from "mongoose";

const VariantSchema = new mongoose.Schema({
  colorName:  { type: String, required: true },   // "Bleu"
  colorCode:  { type: String, required: true },   // "#1B2D5E"
  textColor:  { type: String, default: "#ffffff" }, // couleur du texte du bouton commander
  description: { type: String, default: "" }, // texte affiché sous le sélecteur de couleur sur la fiche produit
  image:      { type: String, default: "" },
  stock:      { type: Number, default: 0 }, // stock disponible pour cette couleur
  editionSize: { type: Number, default: 50 }, // taille de la série limitée (jauge de stock fiche produit)
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

// Le stock global reste toujours la somme des stocks par variante (dès qu'il y en a) —
// il n'existe pas d'entrée manuelle indépendante pour éviter que les deux nombres divergent.
ProductSchema.pre("save", function () {
  if (this.variants && this.variants.length > 0) {
    this.stock = this.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
  }
});

export default mongoose.models.Product || mongoose.model("Product", ProductSchema);
