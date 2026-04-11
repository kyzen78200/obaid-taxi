const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Surveiller uniquement le dossier packages (pour @obaid-taxi/shared)
// Ne pas surveiller toute la racine pour éviter les conflits d'entrée
config.watchFolders = [
  path.resolve(workspaceRoot, 'packages'),
]

// Priorité aux node_modules de apps/mobile sur ceux de la racine
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

module.exports = config
