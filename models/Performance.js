const mongoose = require("mongoose")

const performanceSchema = new mongoose.Schema(
  {
    utilisateur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    periode: {
      annee: {
        type: Number,
        required: true,
        min: 2020,
        max: 2030,
      },
      mois: {
        type: Number,
        required: true,
        min: 1,
        max: 12,
      },
    },
    chiffreAffaires: {
      type: Number,
      required: [true, "Le chiffre d'affaires est requis"],
      min: [0, "Le chiffre d'affaires ne peut pas être négatif"],
    },
    objectifCA: {
      type: Number,
      required: [true, "L'objectif CA est requis"],
      min: [0, "L'objectif CA ne peut pas être négatif"],
    },
    nouveauxClients: {
      type: Number,
      required: [true, "Le nombre de nouveaux clients est requis"],
      min: [0, "Le nombre de nouveaux clients ne peut pas être négatif"],
    },
    rdvRealises: {
      type: Number,
      required: [true, "Le nombre de RDV réalisés est requis"],
      min: [0, "Le nombre de RDV ne peut pas être négatif"],
    },
    rdvPlanifies: {
      type: Number,
      default: 0,
      min: [0, "Le nombre de RDV planifiés ne peut pas être négatif"],
    },
    ventesRealisees: {
      type: Number,
      required: [true, "Le nombre de ventes réalisées est requis"],
      min: [0, "Le nombre de ventes ne peut pas être négatif"],
    },
    dossiersMAJ: {
      type: Number,
      required: [true, "Le nombre de dossiers mis à jour est requis"],
      min: [0, "Le nombre de dossiers ne peut pas être négatif"],
    },
    totalDossiers: {
      type: Number,
      required: [true, "Le nombre total de dossiers est requis"],
      min: [0, "Le nombre total de dossiers ne peut pas être négatif"],
    },
    evenements: {
      type: Number,
      default: 0,
      min: [0, "Le nombre d'événements ne peut pas être négatif"],
    },
    satisfaction: {
      type: Number,
      min: [1, "La note de satisfaction doit être entre 1 et 5"],
      max: [5, "La note de satisfaction doit être entre 1 et 5"],
      default: 4,
    },
    commentaires: {
      type: String,
      maxlength: [500, "Les commentaires ne peuvent pas dépasser 500 caractères"],
    },
    statut: {
      type: String,
      enum: ["brouillon", "valide"],
      default: "valide",
    },
    dateValidation: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Index composé pour éviter les doublons
performanceSchema.index({ utilisateur: 1, "periode.annee": 1, "periode.mois": 1 }, { unique: true })

// Index pour les requêtes fréquentes
performanceSchema.index({ "periode.annee": 1, "periode.mois": 1 })
performanceSchema.index({ statut: 1 })
performanceSchema.index({ createdAt: -1 })

// Virtual pour le taux de transformation
performanceSchema.virtual("tauxTransformation").get(function () {
  if (this.rdvRealises === 0) return 0
  return Math.round((this.ventesRealisees / this.rdvRealises) * 100)
})

// Virtual pour le taux de complétude des dossiers
performanceSchema.virtual("completudeDossiers").get(function () {
  if (this.totalDossiers === 0) return 0
  return Math.round((this.dossiersMAJ / this.totalDossiers) * 100)
})

// Virtual pour le taux d'atteinte de l'objectif
performanceSchema.virtual("tauxObjectif").get(function () {
  if (this.objectifCA === 0) return 0
  return Math.round((this.chiffreAffaires / this.objectifCA) * 100)
})

// Virtual pour la période formatée
performanceSchema.virtual("periodeFormatee").get(function () {
  const mois = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ]
  return `${mois[this.periode.mois - 1]} ${this.periode.annee}`
})

// Middleware pour valider automatiquement
performanceSchema.pre("save", function (next) {
  // Validation des données cohérentes
  if (this.ventesRealisees > this.rdvRealises) {
    return next(new Error("Le nombre de ventes ne peut pas être supérieur au nombre de RDV"))
  }

  if (this.dossiersMAJ > this.totalDossiers) {
    return next(new Error("Le nombre de dossiers mis à jour ne peut pas être supérieur au total"))
  }

  next()
})

// Méthode statique pour obtenir les statistiques d'une période
performanceSchema.statics.getStatsPeriode = function (annee, mois) {
  return this.aggregate([
    {
      $match: {
        "periode.annee": annee,
        "periode.mois": mois,
        statut: "valide",
      },
    },
    {
      $group: {
        _id: null,
        totalCA: { $sum: "$chiffreAffaires" },
        totalObjectif: { $sum: "$objectifCA" },
        totalClients: { $sum: "$nouveauxClients" },
        totalRDV: { $sum: "$rdvRealises" },
        totalVentes: { $sum: "$ventesRealisees" },
        totalEvenements: { $sum: "$evenements" },
        satisfactionMoyenne: { $avg: "$satisfaction" },
        count: { $sum: 1 },
      },
    },
  ])
}

module.exports = mongoose.model("Performance", performanceSchema)
