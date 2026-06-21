import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrgName, isValidEmail, MAX_ORG_NAME } from './team-validation.js';

test('normalizeOrgName trims and collapses whitespace', () => {
  assert.equal(normalizeOrgName('  Smith   Toyota  '), 'Smith Toyota');
});

test('normalizeOrgName returns empty string for unusable input', () => {
  assert.equal(normalizeOrgName('   '), '');
  assert.equal(normalizeOrgName(''), '');
  assert.equal(normalizeOrgName(null), '');
  assert.equal(normalizeOrgName(42), '');
});

test('normalizeOrgName enforces the length cap', () => {
  const long = 'a'.repeat(MAX_ORG_NAME + 50);
  assert.equal(normalizeOrgName(long).length, MAX_ORG_NAME);
});

test('isValidEmail accepts well-formed addresses', () => {
  assert.equal(isValidEmail('fi.manager@dealer.com'), true);
  assert.equal(isValidEmail('  staff@dealer.co.uk  '), true);
});

test('isValidEmail rejects malformed addresses', () => {
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail('missing@domain'), false);
  assert.equal(isValidEmail('@no-local.com'), false);
  assert.equal(isValidEmail('spaces in@email.com'), false);
  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail(null), false);
  assert.equal(isValidEmail('a'.repeat(250) + '@x.com'), false);
});
