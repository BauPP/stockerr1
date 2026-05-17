const test = require('node:test');
const assert = require('node:assert/strict');
const { readContract } = require('./helpers/opencode-contract-fixture.js');

function loadContract() {
  return JSON.parse(readContract('contracts.json')).clickup;
}

function readFixture(relativePath) {
  return readContract(relativePath);
}

test('la skill clickup declara contrato operativo completo, límites MVP y separación del runtime', () => {
  const contract = loadContract();
  const content = readFixture(contract.requiredFiles[1]);

  assert.match(content, /Trigger:/, 'clickup debe exponer triggers observables');
  assert.match(content, /Validaciones Previas/i, 'clickup debe documentar validaciones previas');
  assert.match(content, /Preferred Commands/i, 'clickup debe documentar operaciones preferidas');
  assert.match(content, /(Límites|Limits|Exclusiones)/i, 'clickup debe declarar límites del MVP');
  assert.match(content, /CLICKUP_API_TOKEN/, 'clickup debe usar autenticación local explícita');
  assert.match(content, /URL o ID/i, 'clickup debe resolver tareas por URL o ID');
  assert.match(content, /comentarios|comments/i, 'clickup debe cubrir comentarios en el MVP');
  assert.match(content, /estado|status/i, 'clickup debe cubrir estado de tareas');
  assert.match(content, /asignad|assignee/i, 'clickup debe cubrir asignaciones');
  assert.match(content, /custom fields/i, 'clickup debe cubrir custom fields básicos');
  assert.match(content, /NO .*stockerr1|fuera de `stockerr1`|runtime del producto fuera de alcance/i, 'clickup no debe mezclarse con el runtime del producto');
});

test('la skill clickup falla de forma explícita sin token y no expone secretos', () => {
  const contract = loadContract();
  const content = readFixture(contract.requiredFiles[1]);
  const shared = readFixture(contract.requiredFiles[0]);

  assert.match(content, /falla de forma explícita|det[eé]n.*si falta/i);
  assert.match(content, /no .*expong|no .*imprim|redact/i);
  assert.doesNotMatch(content, /Authorization:\s*Bearer\s+[A-Za-z0-9]/, 'no debe incluir headers reales');
  assert.match(shared, /CLICKUP_API_TOKEN/);
  assert.match(shared, /no imprimir|no persistir|redact/i);
  assert.match(shared, /stockerr1/i, 'shared debe recordar la frontera con el producto');
});

test('la skill clickup deriva solicitudes fuera de alcance y protege acciones destructivas ambiguas', () => {
  const contract = loadContract();
  const content = readFixture(contract.requiredFiles[1]);
  const checklist = readFixture(contract.supportFiles.find((file) => file.endsWith('api-checklist.md')));

  assert.match(content, /otro change|fuera de alcance/i, 'integraciones de producto deben derivarse');
  assert.match(content, /delete|borrar|move|mover|overwrite|sobrescribir/i, 'debe reconocer acciones destructivas');
  assert.match(content, /confirm/i, 'debe pedir confirmación contextual');
  assert.match(checklist, /workspace.*space.*folder.*list.*task/is, 'la checklist debe reflejar la jerarquía completa');
  assert.match(checklist, /det[eé]n|no ejecutes/i, 'la checklist debe frenar mutaciones ambiguas');
  assert.match(checklist, /docs|goals|chat|time tracking|webhooks/i, 'la checklist debe documentar exclusiones explícitas');
});
