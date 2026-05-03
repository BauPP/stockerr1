const test = require('node:test');
const assert = require('node:assert/strict');
const { contractExists, readContract } = require('./helpers/opencode-contract-fixture.js');

function loadContract() {
  return JSON.parse(readContract('contracts.json'));
}

test('la skill clickup crea shared, assets y references mínimos del diseño', () => {
  const contract = loadContract().clickup;
  const requiredFiles = [...contract.requiredFiles, ...contract.supportFiles];

  for (const relativePath of requiredFiles) {
    assert.equal(contractExists(relativePath), true, `${relativePath} debe existir`);
  }
});

test('AGENTS auto-carga clickup por contexto y deriva integraciones de producto fuera del MVP', () => {
  const agents = readContract(loadContract().clickup.agentsFixture);

  assert.match(agents, /\| ClickUp, tareas, comments, estados, URLs\/IDs, espacios, listas \| clickup \|/i);
  assert.match(agents, /clickup/i);
  assert.match(agents, /integraci[oó]n de producto.*ClickUp|ClickUp.*runtime del producto/i);
});

test('la documentaci[oó]n operativa de clickup mantiene transporte HTTP y plantillas seguras', () => {
  const contract = loadContract().clickup;
  const shared = readContract(contract.requiredFiles[0]);
  const skill = readContract(contract.requiredFiles[1]);
  const template = readContract(contract.supportFiles.find((file) => file.endsWith('task-update-template.md')));

  assert.match(shared, /https:\/\/api\.clickup\.com\/api\/v2/i);
  assert.match(shared, /Invoke-RestMethod|curl/i);
  assert.match(skill, /HTTP GET \/task\/\{id\}/i);
  assert.match(skill, /HTTP GET \/list\/\{id\}\/task/i);
  assert.match(skill, /HTTP (POST|PUT|PATCH)/i);
  assert.match(template, /Task ID|List ID|Estado actual|Cambio solicitado|Confirmaci[oó]n/i);
  assert.doesNotMatch(template, /CLICKUP_API_TOKEN\s*=\s*/i, 'la plantilla no debe pedir pegar secretos');
});
