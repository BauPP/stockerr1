const test = require('node:test');
const assert = require('node:assert/strict');
const { contractExists, readContract } = require('./helpers/opencode-contract-fixture.js');

function loadContract() {
  return JSON.parse(readContract('contracts.json'));
}

test('la suite gh-* define el shared y las seis skills MVP', () => {
  const contract = loadContract()['gh-skills'];

  assert.equal(contractExists(contract.sharedFile), true);

  for (const skillName of contract.skills) {
    assert.equal(contractExists(`gh-skills/${skillName}/SKILL.md`), true, `${skillName} debe existir`);
  }
});

test('las skills gh-* incluyen assets y references mínimos del diseño', () => {
  const requiredFiles = loadContract()['gh-skills'].requiredFiles;

  for (const relativePath of requiredFiles) {
    assert.equal(contractExists(relativePath), true, `${relativePath} debe existir`);
  }
});

test('AGENTS y wrappers legacy apuntan a la nueva suite gh-*', () => {
  const contract = loadContract()['gh-skills'];
  const agents = readContract(contract.agentsFixture);
  const branchPr = readContract('gh-skills/legacy/branch-pr/SKILL.md');
  const issueCreation = readContract('gh-skills/legacy/issue-creation/SKILL.md');

  for (const skillName of contract.skills) {
    assert.match(agents, new RegExp(`\\| .*${skillName} .*\\|`));
  }

  assert.match(branchPr, /gh-pr/);
  assert.match(issueCreation, /gh-issue/);
  assert.match(branchPr, /_shared\/gh-cli-common\.md/);
  assert.match(issueCreation, /_shared\/gh-cli-common\.md/);
});

test('las instrucciones globales y de PR mantienen commits en español cuando aplica', () => {
  const shared = readContract(loadContract()['gh-skills'].sharedFile);
  const ghPr = readContract('gh-skills/gh-pr/SKILL.md');

  assert.match(shared, /type\(scope\): descripción en español/);
  assert.match(ghPr, /español/i);
});
