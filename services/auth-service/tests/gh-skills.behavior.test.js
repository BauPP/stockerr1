const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');

const helperPath = './helpers/opencode-contract-fixture.js';

function loadFixtureHelper() {
  delete require.cache[require.resolve(helperPath)];
  return require(helperPath);
}

function readFixture(name) {
  return loadFixtureHelper().readContract(name);
}

function loadContract() {
  return JSON.parse(readFixture('contracts.json'));
}

function assertMatchesAll(content, patterns, contextLabel) {
  for (const pattern of patterns) {
    assert.match(content, new RegExp(pattern, 'i'), `${contextLabel} debe incluir ${pattern}`);
  }
}

test('el helper repo-owned falla claro si falta un fixture y no depende de os.homedir()', () => {
  assert.throws(() => readFixture('missing-fixture.md'), /Missing repo-owned opencode contract fixture: missing-fixture\.md/);

  const originalHomedir = os.homedir;
  os.homedir = () => {
    throw new Error('os.homedir() no debe participar en el baseline repo-owned');
  };

  try {
    const helper = loadFixtureHelper();
    const contracts = JSON.parse(helper.readContract('contracts.json'));

    assert.equal(Array.isArray(contracts['gh-skills'].skills), true);
    assert.equal(helper.contractExists('gh-skills/gh-auth/SKILL.md'), true);
  } finally {
    os.homedir = originalHomedir;
  }
});

test('cada skill gh-* declara contrato operativo completo y límites verificables desde fixtures repo-owned', () => {
  const contract = loadContract()['gh-skills'];

  for (const skill of contract.skills) {
    const content = readFixture(`gh-skills/${skill}/SKILL.md`);

    assertMatchesAll(content, contract.requiredSections, skill);
    assert.match(content, /(Límites|Limits|Exclusiones)/i, `${skill} debe declarar límites o exclusiones`);
  }
});

test('gh-pr y gh-review mantienen ownership no ambiguo para autoría vs revisión', () => {
  const ghPr = readFixture('gh-skills/gh-pr/SKILL.md');
  const ghReview = readFixture('gh-skills/gh-review/SKILL.md');

  assert.match(ghPr, /AUTOR|autoría|publicación/i);
  assert.doesNotMatch(ghPr, /request changes/i, 'gh-pr no debe apropiarse del flujo de review');
  assert.match(ghReview, /approve|aprob/i);
  assert.match(ghReview, /request changes|solicitar cambios/i);
  assert.doesNotMatch(ghReview, /gh pr create/i, 'gh-review no debe apropiarse del flujo de autor');
});

test('gh-actions y gh-release mantienen ownership no ambiguo entre CI y publicación', () => {
  const ghActions = readFixture('gh-skills/gh-actions/SKILL.md');
  const ghRelease = readFixture('gh-skills/gh-release/SKILL.md');

  assert.match(ghActions, /checks|runs|logs|artifacts/i);
  assert.match(ghActions, /deriva a `gh-release`/i);
  assert.doesNotMatch(ghActions, /gh release create/i, 'gh-actions no debe publicar releases');

  assert.match(ghRelease, /release|tag|assets/i);
  assert.match(ghRelease, /gh-actions/i);
  assert.doesNotMatch(ghRelease, /gh run rerun/i, 'gh-release no debe absorber CI general');
});

test('la suite gh-* evita una skill monolítica y deriva capacidades vecinas', () => {
  const ghAuth = readFixture('gh-skills/gh-auth/SKILL.md');
  const ghIssue = readFixture('gh-skills/gh-issue/SKILL.md');
  const ghPr = readFixture('gh-skills/gh-pr/SKILL.md');

  assert.match(ghAuth, /no crea issues, PRs, reviews, actions ni releases/i);
  assert.match(ghIssue, /NO crea ni mergea pull requests/i);
  assert.match(ghPr, /deriva a `gh-review`/i);
});

test('la capa shared obliga validaciones globales y prohíbe saltar controles sensibles', () => {
  const shared = readFixture('gh-skills/_shared/gh-cli-common.md');

  assert.match(shared, /gh auth status/i);
  assert.match(shared, /No ejecutes acciones sensibles sin verificación previa/i);
  assert.match(shared, /No uses flags para saltar controles/i);
  assert.match(shared, /fusionar|aprobar|publicar|liberar/i);
});

test('los wrappers legacy documentan compatibilidad, retiro gradual y herencia shared sin duplicar operación global', () => {
  const branchPr = readFixture('gh-skills/legacy/branch-pr/SKILL.md');
  const issueCreation = readFixture('gh-skills/legacy/issue-creation/SKILL.md');

  assert.match(branchPr, /gh-pr/);
  assert.match(issueCreation, /gh-issue/);
  assert.match(branchPr, /_shared\/gh-cli-common\.md/);
  assert.match(issueCreation, /_shared\/gh-cli-common\.md/);
  assert.match(branchPr, /Retiro gradual/i);
  assert.match(issueCreation, /Retiro gradual/i);
  assert.doesNotMatch(branchPr, /^## Commands$/m, 'branch-pr debe delegar comandos genéricos a gh-pr');
  assert.doesNotMatch(issueCreation, /^## Commands$/m, 'issue-creation debe delegar comandos genéricos a gh-issue');
  assert.doesNotMatch(branchPr, /^## Conventional Commits$/m, 'branch-pr no debe duplicar política global de commits');
});

test('los wrappers legacy condicionan el retiro a adopción, validación y comunicación', () => {
  const branchPr = readFixture('gh-skills/legacy/branch-pr/SKILL.md');
  const issueCreation = readFixture('gh-skills/legacy/issue-creation/SKILL.md');

  assert.match(branchPr, /No retirar `branch-pr` hasta cumplir TODOS estos criterios:/);
  assert.match(branchPr, /activación de `gh-pr` esté validada, comunicada y adoptada/i);
  assert.match(issueCreation, /No retirar `issue-creation` hasta cumplir TODOS estos criterios:/);
  assert.match(issueCreation, /adopción, validación y comunicación/i);
});
