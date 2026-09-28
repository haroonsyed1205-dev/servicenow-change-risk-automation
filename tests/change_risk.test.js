'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { load, plain } = require('./harness');
const samples = require('../sample_data/changes.json');

const ctx = load(['ChangeRiskCalculator.js', 'ChangeConflictChecker.js', 'ChangeApprovalPolicy.js']);
const calc = new ctx.ChangeRiskCalculator();

test('high-exposure normal change scores very high', () => {
  const r = calc.calculate(samples[0]);
  assert.strictEqual(r.score, 30 + 16 + 15 + 8 + 10 + 9);
  assert.strictEqual(r.level, 'very_high');
  assert.strictEqual(r.riskValue, 1);
  assert.ok(r.reasons.length >= 5);
});

test('low-exposure normal change scores low', () => {
  const r = calc.calculate(samples[1]);
  assert.strictEqual(r.score, 14);
  assert.strictEqual(r.level, 'low');
});

test('standard change is fixed low unless tier-1 CI', () => {
  assert.strictEqual(calc.calculate(samples[2]).level, 'low');
  assert.strictEqual(calc.calculate({ type: 'standard', ciCriticality: 1 }).level, 'moderate');
});

test('emergency change adds weight', () => {
  const r = calc.calculate(samples[3]);
  assert.strictEqual(r.score, 20 + 8 + 15 + 10);
  assert.strictEqual(r.level, 'high');
});

test('unknown criticality is treated as tier 1', () => {
  const r = calc.calculate({ type: 'normal', backoutPlanTested: true });
  assert.strictEqual(r.score, 30);
  assert.match(r.reasons[0], /unknown/);
});

test('score is capped at 100', () => {
  const r = calc.calculate({ type: 'emergency', ciCriticality: 1, impactedServices: 50,
    inBusinessHours: true, failedChangesLast90d: 10, implementationMinutes: 999 });
  assert.strictEqual(r.score, 100);
});

test('conflict checker finds CI overlap and blackout', () => {
  const chk = new ctx.ChangeConflictChecker();
  const c = chk.check({ number: 'CHG1', ci: 'db01', start: 100, end: 200, type: 'normal' }, {
    scheduledChanges: [{ number: 'CHG2', ci: 'db01', start: 150, end: 250 },
                       { number: 'CHG3', ci: 'web01', start: 150, end: 250 }],
    blackouts: [{ name: 'Quarter close', start: 190, end: 300 }]
  });
  assert.deepStrictEqual(plain(c.map(x => x.type)), ['ci_already_scheduled', 'blackout']);
});

test('conflict checker: touching windows do not overlap, bad window rejected', () => {
  const chk = new ctx.ChangeConflictChecker();
  assert.strictEqual(chk.check({ ci: 'a', start: 100, end: 200 },
    { scheduledChanges: [{ number: 'X', ci: 'a', start: 200, end: 300 }] }).length, 0);
  assert.strictEqual(chk.check({ ci: 'a', start: 200, end: 100 })[0].type, 'invalid_window');
});

test('maintenance window enforced except for emergencies', () => {
  const chk = new ctx.ChangeConflictChecker();
  const mw = { maintenanceWindows: [{ start: 0, end: 100 }] };
  assert.strictEqual(chk.check({ ci: 'a', start: 50, end: 150, type: 'normal' }, mw)[0].type, 'outside_maintenance');
  assert.strictEqual(chk.check({ ci: 'a', start: 50, end: 150, type: 'emergency' }, mw).length, 0);
});

test('approval policy by type and risk', () => {
  const p = new ctx.ChangeApprovalPolicy();
  const base = { assignmentGroupManager: 'mgr', ciOwnerGroup: 'DB Owners', serviceOwner: 'svc.owner' };
  assert.strictEqual(p.decide({ type: 'standard' }).approvals.length, 0);
  assert.deepStrictEqual(plain(p.decide(Object.assign({ type: 'normal', riskLevel: 'low' }, base)).approvals.map(a => a.approver)), ['mgr']);
  const vh = p.decide(Object.assign({ type: 'normal', riskLevel: 'very_high' }, base));
  assert.deepStrictEqual(plain(vh.approvals.map(a => a.approver)), ['mgr', 'DB Owners', 'Change Advisory Board', 'svc.owner']);
  assert.strictEqual(vh.requiresCab, true);
  const em = p.decide(Object.assign({ type: 'emergency' }, base));
  assert.strictEqual(em.retrospective, true);
  assert.deepStrictEqual(plain(em.approvals.map(a => a.approver)), ['Emergency CAB', 'DB Owners']);
});

test('approval policy de-duplicates approvers', () => {
  const p = new ctx.ChangeApprovalPolicy();
  const r = p.decide({ type: 'normal', riskLevel: 'moderate', assignmentGroupManager: 'X', ciOwnerGroup: 'X' });
  assert.strictEqual(r.approvals.length, 1);
});
