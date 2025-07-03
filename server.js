const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const morgan = require("morgan")
const compression = require("compression")
const mongoSanitize = require("express-mongo-sanitize")
const xss = require("xss-clean")
const rateLimit = require("express-rate-limit")
require("dotenv").config()

const connectDB = require("./config/database")
const authRoutes = require("./routes/auth")
const performanceRoutes = require("./routes/performance")
const { errorHandler, notFound } = require("./middleware/errorMiddleware")

const app = express()
const PORT = process.env.PORT || 5001

// Connexion à la base de données
connectDB()

// Middleware CORS - doit être tout en haut !
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      const allowedOrigins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        process.env.FRONTEND_URL,
      ].filter(Boolean)
      if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        console.log("Origin non autorisée:", origin)
        callback(null, true) // Permissif en développement
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
)

// Middleware de sécurité
app.use(helmet())
app.use(compression())
app.use(mongoSanitize())
app.use(xss())

// Rate limiting
if (process.env.NODE_ENV !== "development") {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limite chaque IP à 100 requêtes par windowMs
    message: {
      error: "Trop de requêtes depuis cette IP, réessayez dans 15 minutes.",
    },
  })
  app.use("/api/", limiter)

  // Rate limiting spécial pour l'authentification
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limite à 10 tentatives de connexion par IP
    message: {
      success: false,
      message: "Trop de tentatives de connexion, réessayez dans 15 minutes.",
    },
  })
  app.use("/api/auth/login", authLimiter)
}

// Middleware de parsing
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Logging détaillé
app.use(morgan("combined"))

// Middleware pour logger toutes les requêtes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  console.log("Headers:", req.headers)
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Body:", req.body)
  }
  next()
})

// Routes de santé
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "WAWTELECOM API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  })
})

// Test de connexion à la base de données
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "API fonctionne correctement",
    timestamp: new Date().toISOString(),
  })
})

// Routes API
app.use("/api/auth", authRoutes)
app.use("/api/performance", performanceRoutes)

// Middleware de gestion d'erreurs
app.use(notFound)
app.use(errorHandler)

// Démarrage du serveur
const server = app.listen(PORT, () => {
  console.log(`🚀 Serveur WAWTELECOM démarré sur le port ${PORT}`)
  console.log(`📊 Environnement: ${process.env.NODE_ENV || "development"}`)
  console.log(`🌐 URL: http://localhost:${PORT}`)
  console.log(`🔗 API: http://localhost:${PORT}/api`)
  console.log(`❤️  Health check: http://localhost:${PORT}/health`)
})

// Gestion gracieuse de l'arrêt
process.on("SIGTERM", () => {
  console.log("👋 SIGTERM reçu, arrêt gracieux du serveur...")
  server.close(() => {
    console.log("✅ Serveur fermé")
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  console.log("👋 SIGINT reçu, arrêt gracieux du serveur...")
  server.close(() => {
    console.log("✅ Serveur fermé")
    process.exit(0)
  })
})

module.exports = app
