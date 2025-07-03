const express = require("express")
const jwt = require("jsonwebtoken")
const { body, validationResult } = require("express-validator")
const User = require("../models/User")
const { protect } = require("../middleware/authMiddleware")

const router = express.Router()

// Génération du token JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "wawtelecom_secret_key", {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  })
}

// @desc    Inscription d'un nouvel utilisateur
// @route   POST /api/auth/register
// @access  Public
router.post(
  "/register",
  [
    body("nom").trim().isLength({ min: 2 }).withMessage("Le nom doit contenir au moins 2 caractères"),
    body("prenom").trim().isLength({ min: 2 }).withMessage("Le prénom doit contenir au moins 2 caractères"),
    body("email").isEmail().normalizeEmail().withMessage("Email invalide"),
    body("password").isLength({ min: 6 }).withMessage("Le mot de passe doit contenir au moins 6 caractères"),
  ],
  async (req, res) => {
    try {
      // Vérification des erreurs de validation
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Données invalides",
          errors: errors.array(),
        })
      }

      const { nom, prenom, email, password, telephone, poste, departement, role } = req.body

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findOne({ email })
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Un utilisateur avec cet email existe déjà",
        })
      }

      // Créer l'utilisateur
      const user = await User.create({
        nom,
        prenom,
        email,
        password,
        telephone,
        poste,
        departement,
        dateEmbauche: new Date(),
        role,
      })

      // Générer le token
      const token = generateToken(user._id)

      res.status(201).json({
        success: true,
        message: "Utilisateur créé avec succès",
        token,
        user: {
          id: user._id,
          nom: user.nom,
          prenom: user.prenom,
          email: user.email,
          nomComplet: user.nomComplet,
          initiales: user.initiales,
          role: user.role,
        },
      })
    } catch (error) {
      console.error("Erreur inscription:", error)
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors de l'inscription",
      })
    }
  },
)

// @desc    Connexion utilisateur
// @route   POST /api/auth/login
// @access  Public
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail().withMessage("Email invalide"),
    body("password").notEmpty().withMessage("Mot de passe requis"),
  ],
  async (req, res) => {
    try {
      // Vérification des erreurs de validation
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Données invalides",
          errors: errors.array(),
        })
      }

      const { email, password } = req.body

      // Trouver l'utilisateur avec le mot de passe
      const user = await User.findOne({ email }).select("+password")

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Identifiants invalides",
        })
      }

      // Vérifier si le compte est bloqué
      if (user.compteBloque) {
        return res.status(423).json({
          success: false,
          message: "Compte bloqué. Contactez l'administrateur.",
        })
      }

      // Vérifier si le compte est actif
      if (user.statut !== "actif") {
        return res.status(403).json({
          success: false,
          message: "Compte inactif. Contactez l'administrateur.",
        })
      }

      // Vérifier le mot de passe
      const isPasswordValid = await user.comparePassword(password)

      if (!isPasswordValid) {
        // Incrémenter les tentatives de connexion
        await user.incrementLoginAttempts()

        return res.status(401).json({
          success: false,
          message: "Identifiants invalides",
        })
      }

      // Mettre à jour la dernière connexion
      await user.updateLastLogin()

      // Générer le token
      const token = generateToken(user._id)

      res.json({
        success: true,
        message: "Connexion réussie",
        token,
        user: {
          id: user._id,
          nom: user.nom,
          prenom: user.prenom,
          email: user.email,
          nomComplet: user.nomComplet,
          initiales: user.initiales,
          derniereConnexion: user.derniereConnexion,
          role: user.role,
        },
      })
    } catch (error) {
      console.error("Erreur connexion:", error)
      res.status(500).json({
        success: false,
        message: "Erreur serveur lors de la connexion",
      })
    }
  },
)

// @desc    Obtenir le profil utilisateur actuel
// @route   GET /api/auth/me
// @access  Private
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)

    res.json({
      success: true,
      user: {
        id: user._id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        statut: user.statut,
        nomComplet: user.nomComplet,
        initiales: user.initiales,
        telephone: user.telephone,
        poste: user.poste,
        departement: user.departement,
        dateEmbauche: user.dateEmbauche,
        derniereConnexion: user.derniereConnexion,
      },
    })
  } catch (error) {
    console.error("Erreur profil:", error)
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    })
  }
})

// @desc    Mettre à jour le profil utilisateur
// @route   PUT /api/auth/profile
// @access  Private
router.put(
  "/profile",
  protect,
  [
    body("nom").optional().trim().isLength({ min: 2 }).withMessage("Le nom doit contenir au moins 2 caractères"),
    body("prenom").optional().trim().isLength({ min: 2 }).withMessage("Le prénom doit contenir au moins 2 caractères"),
    body("telephone").optional().trim(),
    body("poste").optional().trim(),
    body("departement").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Données invalides",
          errors: errors.array(),
        })
      }

      const { nom, prenom, telephone, poste, departement } = req.body

      const user = await User.findByIdAndUpdate(
        req.user.id,
        {
          ...(nom && { nom }),
          ...(prenom && { prenom }),
          ...(telephone && { telephone }),
          ...(poste && { poste }),
          ...(departement && { departement }),
        },
        { new: true, runValidators: true },
      )

      res.json({
        success: true,
        message: "Profil mis à jour avec succès",
        user: {
          id: user._id,
          nom: user.nom,
          prenom: user.prenom,
          email: user.email,
          nomComplet: user.nomComplet,
          initiales: user.initiales,
          telephone: user.telephone,
          poste: user.poste,
          departement: user.departement,
        },
      })
    } catch (error) {
      console.error("Erreur mise à jour profil:", error)
      res.status(500).json({
        success: false,
        message: "Erreur serveur",
      })
    }
  },
)

// @desc    Changer le mot de passe
// @route   PUT /api/auth/change-password
// @access  Private
router.put(
  "/change-password",
  protect,
  [
    body("currentPassword").notEmpty().withMessage("Mot de passe actuel requis"),
    body("newPassword").isLength({ min: 6 }).withMessage("Le nouveau mot de passe doit contenir au moins 6 caractères"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Données invalides",
          errors: errors.array(),
        })
      }

      const { currentPassword, newPassword } = req.body

      // Récupérer l'utilisateur avec le mot de passe
      const user = await User.findById(req.user.id).select("+password")

      // Vérifier le mot de passe actuel
      const isCurrentPasswordValid = await user.comparePassword(currentPassword)
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: "Mot de passe actuel incorrect",
        })
      }

      // Mettre à jour le mot de passe
      user.password = newPassword
      await user.save()

      res.json({
        success: true,
        message: "Mot de passe changé avec succès",
      })
    } catch (error) {
      console.error("Erreur changement mot de passe:", error)
      res.status(500).json({
        success: false,
        message: "Erreur serveur",
      })
    }
  },
)

// @desc    Déconnexion (côté client principalement)
// @route   POST /api/auth/logout
// @access  Private
router.post("/logout", protect, (req, res) => {
  res.json({
    success: true,
    message: "Déconnexion réussie",
  })
})

module.exports = router
