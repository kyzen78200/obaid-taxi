const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [
  path.resolve(workspaceRoot, 'packages'),
]

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// Force toutes les imports de 'react' à utiliser React 19 de apps/mobile
// react-native (à la racine) ferait sinon require('react') → React 18 (racine)
const reactSearchPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    for (const searchPath of reactSearchPaths) {
      try {
        const resolved = require.resolve(moduleName, { paths: [searchPath] })
        return { filePath: resolved, type: 'sourceFile' }
      } catch (_) {}
    }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
