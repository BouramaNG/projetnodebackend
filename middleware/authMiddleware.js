const jwt = require("jsonwebtoken")
const User = require("../models/User")

// Middleware de protection des routes
const protect = async (req, res, next) => {
  let token

  // Vérifier si le token est présent dans les headers
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      // Extraire le token
      token = req.headers.authorization.split(" ")[1]

      // Vérifier le token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "wawtelecom_secret_key")

      // Récupérer l'utilisateur
      const user = await User.findById(decoded.id)

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Token invalide - utilisateur non trouvé",
        })
      }

      // Vérifier si le compte est actif
      if (user.statut !== "actif") {
        return res.status(403).json({
          success: false,
          message: "Compte inactif",
        })
      }

      // Vérifier si le compte n'est pas bloqué
      if (user.compteBloque) {
        return res.status(423).json({
          success: false,
          message: "Compte bloqué",
        })
      }

      // Ajouter l'utilisateur à la requête
      req.user = {
        id: user._id.toString(),
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
      }

      next()
    } catch (error) {
      console.error("Erreur authentification:", error)

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Token invalide",
        })
      }

      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expiré",
        })
      }

      return res.status(401).json({
        success: false,
        message: "Accès non autorisé",
      })
    }
  } else {
    return res.status(401).json({
      success: false,
      message: "Accès non autorisé - Token manquant",
    })
  }
}

// Middleware d'autorisation par rôle
const authorizeRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      // Charger l'utilisateur complet si besoin
      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: "Utilisateur non authentifié" })
      }
      const user = await User.findById(req.user.id)
      if (!user) {
        return res.status(401).json({ success: false, message: "Utilisateur non trouvé" })
      }
      if (!roles.includes(user.role)) {
        return res.status(403).json({ success: false, message: "Accès interdit : rôle insuffisant" })
      }
      next()
    } catch (error) {
      return res.status(500).json({ success: false, message: "Erreur serveur d'autorisation" })
    }
  }
}

module.exports = {
  protect,
  authorizeRoles,
}
