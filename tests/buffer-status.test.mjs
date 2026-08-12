import assert from 'node:assert/strict';
import test from 'node:test';
import { getBufferVisualState } from '../js/services/buffer-status.js';

test('ohne Mindestpuffer wird kein erfundener Prozentwert gezeigt', () => {
  const state = getBufferVisualState(150000, 0);
  assert.equal(state.stage, 'unset');
  assert.equal(state.ratioPercent, null);
  assert.equal(state.progressPercent, 0);
});

test('Tresorstufen folgen dem Mindestpuffer', () => {
  const target = 100000;
  assert.equal(getBufferVisualState(-1, target).stage, 'empty');
  assert.equal(getBufferVisualState(5000, target).stage, 'almost-empty');
  assert.equal(getBufferVisualState(10000, target).stage, '10');
  assert.equal(getBufferVisualState(25000, target).stage, '25');
  assert.equal(getBufferVisualState(50000, target).stage, '50');
  assert.equal(getBufferVisualState(75000, target).stage, '75');
  assert.equal(getBufferVisualState(100000, target).stage, 'full');
});

test('99 Prozent zeigt noch nicht den vollen Tresor, 100 Prozent schon', () => {
  assert.equal(getBufferVisualState(99000, 100000).stage, '75');
  const full = getBufferVisualState(100000, 100000);
  assert.equal(full.stage, 'full');
  assert.equal(full.progressPercent, 100);
  assert.equal(full.deltaCents, 0);
});

test('Fortschrittsbalken wird bei mehr als 100 Prozent gedeckelt', () => {
  const state = getBufferVisualState(180000, 100000);
  assert.equal(state.ratioPercent, 180);
  assert.equal(state.progressPercent, 100);
});
