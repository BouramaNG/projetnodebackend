const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

const userSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: [true, "Le nom est requis"],
      trim: true,
      maxlength: [50, "Le nom ne peut pas dépasser 50 caractères"],
    },
    prenom: {
      type: String,
      required: [true, "Le prénom est requis"],
      trim: true,
      maxlength: [50, "Le prénom ne peut pas dépasser 50 caractères"],
    },
    email: {
      type: String,
      required: [true, "L'email est requis"],
      unique: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Veuillez entrer un email valide"],
    },
    password: {
      type: String,
      required: [true, "Le mot de passe est requis"],
      minlength: [6, "Le mot de passe doit contenir au moins 6 caractères"],
      select: false,
    },
    statut: {
      type: String,
      enum: ["actif", "inactif"],
      default: "actif",
    },
    role: {
      type: String,
      enum: ["admin", "manager", "utilisateur"],
      default: "utilisateur",
    },
    avatar: {
      type: String,
      default: null,
    },
    telephone: {
      type: String,
      trim: true,
    },
    poste: {
      type: String,
      trim: true,
    },
    departement: {
      type: String,
      trim: true,
    },
    dateEmbauche: {
      type: Date,
    },
    derniereConnexion: {
      type: Date,
      default: Date.now,
    },
    tentativesConnexion: {
      type: Number,
      default: 0,
    },
    compteBloque: {
      type: Boolean,
      default: false,
    },
    dateBlocage: {
      type: Date,
    },
    tokenResetPassword: String,
    expireResetPassword: Date,
    emailVerifie: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Index pour les performances
userSchema.index({ email: 1 })
userSchema.index({ statut: 1 })

// Virtual pour le nom complet
userSchema.virtual("nomComplet").get(function () {
  return `${this.prenom} ${this.nom}`
})

// Virtual pour les initiales
userSchema.virtual("initiales").get(function () {
  return `${this.prenom.charAt(0)}${this.nom.charAt(0)}`.toUpperCase()
})

// Middleware pour hasher le mot de passe avant sauvegarde
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()

  try {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password)
}

// Méthode pour mettre à jour la dernière connexion
userSchema.methods.updateLastLogin = function () {
  this.derniereConnexion = new Date()
  this.tentativesConnexion = 0
  return this.save({ validateBeforeSave: false })
}

// Méthode pour incrémenter les tentatives de connexion
userSchema.methods.incrementLoginAttempts = function () {
  this.tentativesConnexion += 1

  // Bloquer le compte après 5 tentatives
  if (this.tentativesConnexion >= 5) {
    this.compteBloque = true
    this.dateBlocage = new Date()
  }

  return this.save({ validateBeforeSave: false })
}

// Méthode pour débloquer le compte
userSchema.methods.unlockAccount = function () {
  this.compteBloque = false
  this.tentativesConnexion = 0
  this.dateBlocage = undefined
  return this.save({ validateBeforeSave: false })
}

module.exports = mongoose.model("User", userSchema)
