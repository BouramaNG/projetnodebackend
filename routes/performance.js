const express = require("express")
const { body, validationResult, query } = require("express-validator")
const Performance = require("../models/Performance")
const { protect, authorizeRoles } = require("../middleware/authMiddleware")

const router = express.Router()

// Toutes les routes nécessitent une authentification
router.use(protect)

// @desc    Créer ou mettre à jour les données de performance
// @route   POST /api/performance
// @access  Private
router.post(
  "/",
  [
    body("periode.annee").isInt({ min: 2020, max: 2030 }).withMessage("Année invalide"),
    body("periode.mois").isInt({ min: 1, max: 12 }).withMessage("Mois invalide"),
    body("chiffreAffaires").isNumeric().withMessage("Chiffre d'affaires invalide"),
    body("objectifCA").isNumeric().withMessage("Objectif CA invalide"),
    body("nouveauxClients").isInt({ min: 0 }).withMessage("Nombre de nouveaux clients invalide"),
    body("rdvRealises").isInt({ min: 0 }).withMessage("Nombre de RDV invalide"),
    body("ventesRealisees").isInt({ min: 0 }).withMessage("Nombre de ventes invalide"),
    body("dossiersMAJ").isInt({ min: 0 }).withMessage("Nombre de dossiers invalide"),
    body("totalDossiers").isInt({ min: 0 }).withMessage("Total dossiers invalide"),
    body("evenements").optional().isInt({ min: 0 }).withMessage("Nombre d'événements invalide"),
    body("satisfaction").optional().isFloat({ min: 1, max: 5 }).withMessage("Note de satisfaction invalide"),
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

      const performanceData = {
        ...req.body,
        utilisateur: req.user.id,
      }

      // Vérifier si des données existent déjà pour cette période
      const existingPerformance = await Performance.findOne({
        utilisateur: req.user.id,
        "periode.annee": req.body.periode.annee,
        "periode.mois": req.body.periode.mois,
      })

      let performance

      if (existingPerformance) {
        // Mettre à jour les données existantes
        performance = await Performance.findByIdAndUpdate(existingPerformance._id, performanceData, {
          new: true,
          runValidators: true,
        }).populate("utilisateur", "nom prenom email")
      } else {
        // Créer de nouvelles données
        performance = await Performance.create(performanceData)
        await performance.populate("utilisateur", "nom prenom email")
      }

      res.status(existingPerformance ? 200 : 201).json({
        success: true,
        message: existingPerformance ? "Données mises à jour avec succès" : "Données créées avec succès",
        data: performance,
      })
    } catch (error) {
      console.error("Erreur création/mise à jour performance:", error)

      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "Des données existent déjà pour cette période",
        })
      }

      res.status(500).json({
        success: false,
        message: "Erreur serveur",
      })
    }
  },
)

// @desc    Obtenir les données de performance de l'utilisateur
// @route   GET /api/performance
// @access  Private
router.get(
  "/",
  [
    query("annee").optional().isInt({ min: 2020, max: 2030 }).withMessage("Année invalide"),
    query("mois").optional().isInt({ min: 1, max: 12 }).withMessage("Mois invalide"),
    query("statut").optional().isIn(["brouillon", "valide"]).withMessage("Statut invalide"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limite invalide"),
    query("page").optional().isInt({ min: 1 }).withMessage("Page invalide"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Paramètres invalides",
          errors: errors.array(),
        })
      }

      const { annee, mois, statut, limit = 12, page = 1 } = req.query

      // Construction du filtre
      const filter = { utilisateur: req.user.id }

      if (annee) filter["periode.annee"] = Number.parseInt(annee)
      if (mois) filter["periode.mois"] = Number.parseInt(mois)
      if (statut) filter.statut = statut

      // Pagination
      const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)

      // Requête avec pagination
      const performances = await Performance.find(filter)
        .populate("utilisateur", "nom prenom email")
        .sort({ "periode.annee": -1, "periode.mois": -1 })
        .limit(Number.parseInt(limit))
        .skip(skip)

      // Compter le total pour la pagination
      const total = await Performance.countDocuments(filter)

      res.json({
        success: true,
        data: performances,
        pagination: {
          page: Number.parseInt(page),
          limit: Number.parseInt(limit),
          total,
          pages: Math.ceil(total / Number.parseInt(limit)),
        },
      })
    } catch (error) {
      console.error("Erreur récupération performances:", error)
      res.status(500).json({
        success: false,
        message: "Erreur serveur",
      })
    }
  },
)

// @desc    Obtenir toutes les performances (vue d'ensemble)
// @route   GET /api/performance/all
// @access  Admin/Manager uniquement
router.get(
  "/all",
  authorizeRoles("admin", "manager"),
  async (req, res) => {
    try {
      const performances = await Performance.find()
        .populate("utilisateur", "nom prenom email role")
        .sort({ "periode.annee": -1, "periode.mois": -1 })
      res.json({
        success: true,
        data: performances,
      })
    } catch (error) {
      console.error("Erreur récupération performances (all):", error)
      res.status(500).json({
        success: false,
        message: "Erreur serveur",
      })
    }
  },
)

// @desc    Obtenir une donnée de performance spécifique
// @route   GET /api/performance/:id
// @access  Private
router.get("/:id", async (req, res) => {
  try {
    const performance = await Performance.findById(req.params.id).populate("utilisateur", "nom prenom email")

    if (!performance) {
      return res.status(404).json({
        success: false,
        message: "Données de performance non trouvées",
      })
    }

    // Vérifier que l'utilisateur peut accéder à ces données
    if (performance.utilisateur._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Accès non autorisé",
      })
    }

    res.json({
      success: true,
      data: performance,
    })
  } catch (error) {
    console.error("Erreur récupération performance:", error)
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    })
  }
})

// @desc    Supprimer des données de performance
// @route   DELETE /api/performance/:id
// @access  Private
router.delete("/:id", async (req, res) => {
  try {
    const performance = await Performance.findById(req.params.id)

    if (!performance) {
      return res.status(404).json({
        success: false,
        message: "Données de performance non trouvées",
      })
    }

    // Vérifier que l'utilisateur peut supprimer ces données
    if (performance.utilisateur.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Accès non autorisé",
      })
    }

    await Performance.findByIdAndDelete(req.params.id)

    res.json({
      success: true,
      message: "Données supprimées avec succès",
    })
  } catch (error) {
    console.error("Erreur suppression performance:", error)
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    })
  }
})

// @desc    Obtenir les statistiques de performance
// @route   GET /api/performance/stats/summary
// @access  Private
router.get("/stats/summary", async (req, res) => {
  try {
    const { annee = new Date().getFullYear(), mois } = req.query

    // Filtre de base
    const matchFilter = {
      utilisateur: req.user.id,
      "periode.annee": Number.parseInt(annee),
      statut: "valide",
    }

    if (mois) {
      matchFilter["periode.mois"] = Number.parseInt(mois)
    }

    const stats = await Performance.aggregate([
      { $match: matchFilter },
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

    const result = stats[0] || {
      totalCA: 0,
      totalObjectif: 0,
      totalClients: 0,
      totalRDV: 0,
      totalVentes: 0,
      totalEvenements: 0,
      satisfactionMoyenne: 0,
      count: 0,
    }

    // Calculer les taux
    result.tauxTransformation = result.totalRDV > 0 ? Math.round((result.totalVentes / result.totalRDV) * 100) : 0
    result.tauxObjectif = result.totalObjectif > 0 ? Math.round((result.totalCA / result.totalObjectif) * 100) : 0

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error("Erreur statistiques performance:", error)
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
    })
  }
})

module.exports = router
