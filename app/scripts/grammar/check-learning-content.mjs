import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('../../src/data/grammarPoints.json', import.meta.url), 'utf8'));
const grammarIds = new Set(catalog.map(({ id }) => id));
const identifier = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const normalized = value => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function fields(value, keys, path) {
  for (const key of keys) assert.ok(nonempty(value?.[key]), `${path}.${key} must be text`);
}

function example(value, path) {
  fields(value, ['sentence', 'translation', 'why'], path);
  assert.ok(Array.isArray(value.chunks) && value.chunks.length >= 2, `${path}.chunks must have at least two parts`);
  for (const [index, chunk] of value.chunks.entries()) {
    fields(chunk, ['text', 'role'], `${path}.chunks[${index}]`);
    if (chunk.term !== undefined) fields(chunk, ['term'], `${path}.chunks[${index}]`);
  }
  assert.equal(normalized(value.chunks.map(chunk => chunk.text).join(' ')), normalized(value.sentence), `${path} chunks must reconstruct the sentence`);
}

function item(value, path) {
  fields(value, ['id', 'sentence', 'prompt', 'correctOptionId'], path);
  assert.match(value.id, identifier, `${path}.id`);
  assert.ok(Array.isArray(value.options) && value.options.length >= 2, `${path} needs at least two options`);
  const ids = new Set();
  for (const [index, option] of value.options.entries()) {
    fields(option, ['id', 'text', 'feedback'], `${path}.options[${index}]`);
    assert.match(option.id, identifier, `${path}.options[${index}].id`);
    assert.ok(!ids.has(option.id), `${path} repeats option ${option.id}`);
    ids.add(option.id);
  }
  assert.ok(ids.has(value.correctOptionId), `${path} correct option is missing`);
}

function lesson(value) {
  fields(value, ['goalId', 'title', 'objective', 'rule', 'boundary'], 'lesson');
  const path = value.goalId;
  assert.match(path, identifier, 'lesson.goalId');
  assert.ok(Number.isInteger(value.version) && value.version >= 1, `${path}.version must be a positive integer`);
  assert.ok(Array.isArray(value.grammarIds) && value.grammarIds.length > 0, `${path}.grammarIds must have at least one ID`);
  assert.equal(new Set(value.grammarIds).size, value.grammarIds.length, `${path} repeats a grammar ID`);
  for (const id of value.grammarIds) assert.ok(grammarIds.has(id), `${path} uses unknown grammar ID ${id}`);
  assert.ok(Array.isArray(value.examples) && value.examples.length >= 2, `${path} needs contrasting examples`);
  for (const [index, entry] of value.examples.entries()) example(entry, `${path}.examples[${index}]`);
  fields(value.repair, ['explanation'], `${path}.repair`);
  example(value.repair.example, `${path}.repair.example`);
  const items = [value.reasoning, value.repair.practice, value.transfer, value.delayed];
  for (const [index, entry] of items.entries()) item(entry, `${path}.item[${index}]`);
  assert.equal(new Set(items.map(entry => entry.id)).size, items.length, `${path} repeats an item ID`);
  const taught = [...value.examples, value.reasoning, value.repair.example, value.repair.practice];
  for (const entry of [value.transfer, value.delayed]) {
    assert.ok(taught.every(previous => normalized(previous.sentence) !== normalized(entry.sentence)), `${path} reuses a sentence in ${entry.id}`);
    taught.push(entry);
  }
}

const files = process.argv.slice(2);
assert.ok(files.length, 'Usage: node scripts/grammar/check-learning-content.mjs <lesson.json> [...]');
const versions = new Set();
for (const file of files) {
  const data = JSON.parse(readFileSync(file, 'utf8'));
  for (const entry of Array.isArray(data) ? data : [data]) {
    lesson(entry);
    const key = `${entry.goalId}:${entry.version}`;
    assert.ok(!versions.has(key), `Duplicate content version: ${key}`);
    versions.add(key);
  }
}
assert.ok(versions.size, 'No grammar lessons supplied');
console.log(`Validated ${versions.size} grammar lesson version(s) against ${grammarIds.size} catalog topics.`);
