const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
require("dotenv").config()

const User = require("../models/User")
const Performance = require("../models/Performance")

// Connexion à la base de données
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/wawtelecom")
    console.log("📊 MongoDB connecté pour le seeding")
  } catch (error) {
    console.error("❌ Erreur de connexion MongoDB:", error)
    process.exit(1)
  }
}

// Données de test
const seedUsers = [
  {
    nom: "Thérése",
    prenom: "Marie",
    email: "marie@wawtelecom.com",
    password: "password123",
    telephone: "+221 77 123 45 67",
    poste: "Directrice Commerciale",
    departement: "Commercial",
    dateEmbauche: new Date("2020-01-15"),
  },
  {
    nom: "Ngom",
    prenom: "Bourama",
    email: "boura@wawtelecom.com",
    password: "password123",
    telephone: "+221 76 987 65 43",
    poste: "Manager Commercial",
    departement: "Commercial",
    dateEmbauche: new Date("2021-03-10"),
  },
  {
    nom: "Fall",
    prenom: "Binta",
    email: "binta@wawtelecom.com",
    password: "password123",
    telephone: "+221 78 456 78 90",
    poste: "Commerciale",
    departement: "Commercial",
    dateEmbauche: new Date("2022-06-01"),
  },
]

// Fonction pour générer des données de performance aléatoires
const generatePerformanceData = (userId, year = 2024) => {
  const performances = []

  for (let month = 1; month <= 12; month++) {
    const baseCA = 80000 + Math.random() * 60000
    const objectifCA = baseCA * (0.85 + Math.random() * 0.3)
    const rdv = 30 + Math.floor(Math.random() * 25)
    const ventes = Math.floor(rdv * (0.5 + Math.random() * 0.3))

    performances.push({
      utilisateur: userId,
      periode: { annee: year, mois: month },
      chiffreAffaires: Math.round(baseCA),
      objectifCA: Math.round(objectifCA),
      nouveauxClients: 15 + Math.floor(Math.random() * 15),
      rdvRealises: rdv,
      rdvPlanifies: rdv + Math.floor(Math.random() * 10),
      ventesRealisees: ventes,
      dossiersMAJ: 100 + Math.floor(Math.random() * 100),
      totalDossiers: 150 + Math.floor(Math.random() * 100),
      evenements: Math.floor(Math.random() * 12),
      satisfaction: 3.5 + Math.random() * 1.5,
      statut: "valide",
      dateValidation: new Date(),
    })
  }

  return performances
}

// Fonction principale de seeding
const seedDatabase = async () => {
  try {
    console.log("🌱 Début du seeding de la base de données...")

    // Supprimer les données existantes
    await User.deleteMany({})
    await Performance.deleteMany({})
    console.log("🗑️  Données existantes supprimées")

    // Créer les utilisateurs
    const createdUsers = []
    for (const userData of seedUsers) {
      const user = await User.create(userData)
      createdUsers.push(user)
      console.log(`👤 Utilisateur créé: ${user.nomComplet} (${user.email})`)
    }

    // Créer les données de performance pour chaque utilisateur
    for (const user of createdUsers) {
      const performanceData = generatePerformanceData(user._id)
      await Performance.insertMany(performanceData)
      console.log(`📊 ${performanceData.length} enregistrements de performance créés pour ${user.nomComplet}`)
    }

    console.log("✅ Seeding terminé avec succès!")
    console.log("\n📋 Comptes de test créés:")
    seedUsers.forEach((user) => {
      console.log(`   Email: ${user.email} | Mot de passe: ${user.password}`)
    })
  } catch (error) {
    console.error("❌ Erreur lors du seeding:", error)
  } finally {
    mongoose.connection.close()
  }
}

// Exécuter le seeding si le script est appelé directement
if (require.main === module) {
  connectDB().then(() => {
    seedDatabase()
  })
}

module.exports = { seedDatabase }
