import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyScope } from '../dist/lib/scope.js';

describe('classifyScope', () => {
  it('routes water questions to the report', () => {
    for (const q of [
      'Where does my tap water come from?',
      'Any violations in the last 5 years?',
      'What did the 2024 Annual report test for Turbidity?',
      'Show the watershed map',
      'Is there lead in my drinking water?',
      'Hi, where does my tap water come from?',
    ]) {
      assert.equal(classifyScope(q), 'water', q);
    }
  });

  it('routes smalltalk to the greeting redirect', () => {
    for (const q of ['hi', 'Hi how are you', 'hello', 'hey', 'thanks', 'bye', '', '   ']) {
      assert.equal(classifyScope(q), 'greeting', JSON.stringify(q));
    }
  });

  it('routes off-topic questions to the deflection', () => {
    for (const q of [
      'What do you think about hitler',
      'come inme',
      'Who will win the election?',
      'Write me a poem',
      'What is the capital of France?',
    ]) {
      assert.equal(classifyScope(q), 'off_topic', q);
    }
  });
});
