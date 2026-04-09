const { spawnSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const targets = [
  { name: 'Raíz del proyecto', dir: rootDir },
  { name: 'Auth Service', dir: path.join(rootDir, 'services', 'auth-service') },
  { name: 'User Service', dir: path.join(rootDir, 'services', 'user-service') },
  { name: 'API Gateway', dir: path.join(rootDir, 'api-gateway') },
];

function runInstall(target) {
  console.log(`\n📦 Instalando dependencias en: ${target.name}`);
  console.log(`   Ruta: ${target.dir}`);

  const result = spawnSync('npm', ['install'], {
    cwd: target.dir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(`Falló la instalación en ${target.name}`);
  }
}

function main() {
  console.log('🚀 Inicio de bootstrap de dependencias por servicio');
  targets.forEach(runInstall);
  console.log('\n✅ Bootstrap completado correctamente');
}

try {
  main();
} catch (error) {
  console.error(`\n❌ ${error.message}`);
  process.exit(1);
}
