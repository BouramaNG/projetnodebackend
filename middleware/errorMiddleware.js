// Middleware pour les routes non trouvées
const notFound = (req, res, next) => {
  const error = new Error(`Route non trouvée - ${req.originalUrl}`)
  res.status(404)
  next(error)
}

// Middleware de gestion d'erreurs global
const errorHandler = (err, req, res, next) => {
  let error = { ...err }
  error.message = err.message

  // Log de l'erreur
  console.error("Erreur:", err)

  // Erreur de validation Mongoose
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ")
    error = {
      message,
      statusCode: 400,
    }
  }

  // Erreur de duplication Mongoose
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0]
    const message = `${field} existe déjà`
    error = {
      message,
      statusCode: 400,
    }
  }

  // Erreur ObjectId Mongoose invalide
  if (err.name === "CastError") {
    const message = "Ressource non trouvée"
    error = {
      message,
      statusCode: 404,
    }
  }

  // Erreur JWT
  if (err.name === "JsonWebTokenError") {
    const message = "Token invalide"
    error = {
      message,
      statusCode: 401,
    }
  }

  // Token expiré
  if (err.name === "TokenExpiredError") {
    const message = "Token expiré"
    error = {
      message,
      statusCode: 401,
    }
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Erreur serveur",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  })
}

module.exports = {
  notFound,
  errorHandler,
}
