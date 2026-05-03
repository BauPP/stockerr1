const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const workspaceRoot = path.resolve(__dirname, '..');
function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf8'));
}

function run(command, cwd = workspaceRoot) {
  const result = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
        cwd,
        encoding: 'utf8',
      })
    : spawnSync('sh', ['-lc', command], {
        cwd,
        encoding: 'utf8',
      });

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function runNpmTest(relativePrefix) {
  return run(`npm --prefix ${relativePrefix} test`);
}

function createChildEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('NODE_')),
  );
}

function runNodeTestGlob(relativeServicePath) {
  const result = spawnSync(process.execPath, ['--test', 'tests/**/*.test.js'], {
    cwd: path.join(workspaceRoot, relativeServicePath),
    encoding: 'utf8',
    env: createChildEnv(),
  });

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function runConfiguredRunner() {
  const steps = [
    () => runNodeTestGlob('services/auth-service'),
    () => runNodeTestGlob('api-gateway'),
    () => runNpmTest('services/user-service'),
    () => runNpmTest('services/product-service'),
  ];
  const outputs = [];

  for (const step of steps) {
    const result = step();
    outputs.push(result.stdout, result.stderr);

    if (result.status !== 0) {
      return {
        status: result.status,
        stdout: outputs.join(''),
        stderr: '',
      };
    }
  }

  return {
    status: 0,
    stdout: outputs.join(''),
    stderr: '',
  };
}

function runGit(args) {
  const gitCommand = process.platform === 'win32' ? 'git.exe' : 'git';
  const result = spawnSync(gitCommand, args, {
    cwd: workspaceRoot,
    encoding: 'utf8',
  });

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function withTemporaryFile(relativePath, contents, callback) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents, 'utf8');

  try {
    callback();
  } finally {
    fs.rmSync(absolutePath, { force: true });
  }
}

function escapePathForRunnerOutput(filePath) {
  return filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('/', '[\\\\/]');
}

test('targeted service manifests stay valid and declare honest test contracts', () => {
  const authManifest = readJson('services/auth-service/package.json');
  const userManifest = readJson('services/user-service/package.json');
  const productManifest = readJson('services/product-service/package.json');

  assert.equal(authManifest.scripts.test, 'node --test "tests/**/*.test.js"');
  assert.equal(userManifest.scripts.test, 'node -e "console.log(\'baseline: no tests yet\')"');
  assert.equal(productManifest.scripts.test, 'node -e "console.log(\'baseline: no tests yet\')"');
  assert.equal(productManifest.name, 'product-service');
  assert.equal(productManifest.main, 'server.js');
  assert.equal(productManifest.scripts.start, 'node server.js');
  assert.deepEqual(productManifest.dependencies, {
    cors: '^2.8.6',
    dotenv: '^17.3.1',
    express: '^5.2.1',
    pg: '^8.20.0',
  });
});

test('no-test services report the baseline explicitly without simulating regressions', () => {
  const userResult = runNpmTest('services/user-service');
  const productResult = runNpmTest('services/product-service');

  assert.equal(userResult.status, 0, userResult.stderr || userResult.stdout);
  assert.match(`${userResult.stdout}${userResult.stderr}`, /baseline: no tests yet/);
  assert.equal(productResult.status, 0, productResult.stderr || productResult.stdout);
  assert.match(`${productResult.stdout}${productResult.stderr}`, /baseline: no tests yet/);
  assert.doesNotMatch(`${productResult.stdout}${productResult.stderr}`, /Error: no test specified/);
});

test('the cross-service runner no longer fails because of broken manifests or placeholder scripts', () => {
  const result = runConfiguredRunner();
  const output = `${result.stdout}${result.stderr}`;

  assert.doesNotMatch(output, /ERR_INVALID_PACKAGE_CONFIG|Unexpected end of JSON input|Invalid package\.json/i);
  assert.doesNotMatch(output, /Error: no test specified/);
});

test('git hygiene ignores local dependency artifacts without masking source files', () => {
  const ignoredNodeModules = runGit(['check-ignore', 'services/auth-service/node_modules/type-is/package.json']);
  const ignoredSiblingNodeModules = runGit(['check-ignore', 'services/user-service/node_modules/vary/package.json']);
  const visibleSource = runGit(['check-ignore', 'services/product-service/src/app.js']);

  assert.equal(ignoredNodeModules.status, 0, ignoredNodeModules.stderr || ignoredNodeModules.stdout);
  assert.equal(ignoredSiblingNodeModules.status, 0, ignoredSiblingNodeModules.stderr || ignoredSiblingNodeModules.stdout);
  assert.notEqual(visibleSource.status, 0, visibleSource.stderr || visibleSource.stdout);
});

test('the cross-service runner preserves a genuine referenced-service failure', () => {
  const tempFailingTest = 'services/auth-service/tests/repo-test-baseline.runtime-proof.test.js';

  withTemporaryFile(tempFailingTest, [
    "const test = require('node:test');",
    "const assert = require('node:assert/strict');",
    '',
    "test('runtime proof for referenced-service failure', () => {",
    "  assert.equal('referenced-service-runtime-proof', 'expected-real-failure-marker');",
    '});',
    '',
  ].join('\n'), () => {
    const result = runConfiguredRunner();
    const output = `${result.stdout}${result.stderr}`;

    assert.notEqual(result.status, 0, 'the global runner should fail when a referenced-service test fails');
    assert.match(output, /expected-real-failure-marker/);
    assert.match(output, new RegExp(escapePathForRunnerOutput(tempFailingTest)));
    assert.doesNotMatch(output, /ERR_INVALID_PACKAGE_CONFIG|Unexpected end of JSON input|Invalid package\.json/i);
    assert.doesNotMatch(output, /Error: no test specified/);
  });
});

test('git hygiene also ignores standard transient artifacts without hiding source files', () => {
  const ignoredCoverageFile = runGit(['check-ignore', 'coverage/lcov.info']);
  const ignoredDebugLog = runGit(['check-ignore', 'npm-debug.log.2026-05-03']);
  const visibleRootTest = runGit(['check-ignore', 'tests/repo-test-baseline.test.js']);

  assert.equal(ignoredCoverageFile.status, 0, ignoredCoverageFile.stderr || ignoredCoverageFile.stdout);
  assert.equal(ignoredDebugLog.status, 0, ignoredDebugLog.stderr || ignoredDebugLog.stdout);
  assert.notEqual(visibleRootTest.status, 0, visibleRootTest.stderr || visibleRootTest.stdout);
});
