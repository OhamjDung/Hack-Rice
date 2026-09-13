import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.SESSION_SECRET = 'test-secret';
import { hashPassword, verifyPassword } from '../src/lib/password.ts';
import { createSessionToken, verifySessionToken } from '../src/lib/session.ts';

test('hashPassword produces a verifiable, salted hash', async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.ok(hash.includes(':'));
  assert.equal(await verifyPassword('correct horse battery staple', hash), true);
  assert.equal(await verifyPassword('wrong password', hash), false);
});

test('two hashes of the same password differ (random salt)', async () => {
  const a = await hashPassword('same password');
  const b = await hashPassword('same password');
  assert.notEqual(a, b);
});

test('session token round-trips to the same userId', () => {
  const token = createSessionToken('user-123');
  assert.equal(verifySessionToken(token), 'user-123');
});

test('session token rejects tampering', () => {
  const token = createSessionToken('user-123');
  const forged = 'user-456' + token.slice(token.indexOf('.'));
  assert.equal(verifySessionToken(forged), null);
});

test('session token rejects garbage input', () => {
  assert.equal(verifySessionToken(null), null);
  assert.equal(verifySessionToken('no-dot-here'), null);
});
