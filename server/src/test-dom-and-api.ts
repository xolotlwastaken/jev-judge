import assert from 'node:assert';
import { classifyPost } from './jev.js';

// Test simulated Jev classification
async function runTests() {
  console.log('🧪 Starting Verification Tests...\n');

  // Test 1: Breaking classification
  console.log('Test 1: Breaking post classification...');
  const breakingPost = 'OpenAI just announced GPT-5 open weights with full documentation and API release!';
  const res1 = await classifyPost(breakingPost, false);
  assert.strictEqual(res1.category, 'breaking', `Expected breaking but got ${res1.category}`);
  assert.ok(res1.confidence >= 0.8, 'Expected high confidence');
  console.log('✓ Test 1 passed: Classified as BREAKING (' + Math.round(res1.confidence * 100) + '%)\n');

  // Test 2: Golden Nugget classification
  console.log('Test 2: Golden Nugget post classification...');
  const nuggetPost = 'Here is a complete step-by-step tutorial on building AI agents in TypeScript with SQLite storage.';
  const res2 = await classifyPost(nuggetPost, false);
  assert.strictEqual(res2.category, 'golden_nugget', `Expected golden_nugget but got ${res2.category}`);
  console.log('✓ Test 2 passed: Classified as GOLDEN NUGGET (' + Math.round(res2.confidence * 100) + '%)\n');

  // Test 3: AI Slop classification
  console.log('Test 3: AI Slop post classification...');
  const slopPost = '99% of people have no idea AI will replace all developers in 6 months. Agree? Bookmark this thread!';
  const res3 = await classifyPost(slopPost, false);
  assert.strictEqual(res3.category, 'ai_slop', `Expected ai_slop but got ${res3.category}`);
  console.log('✓ Test 3 passed: Classified as AI SLOP (' + Math.round(res3.confidence * 100) + '%)\n');

  // Test 4: Meh classification
  console.log('Test 4: Meh post classification...');
  const mehPost = 'Just had coffee and heading out for lunch. Good morning everyone!';
  const res4 = await classifyPost(mehPost, false);
  assert.strictEqual(res4.category, 'meh', `Expected meh but got ${res4.category}`);
  console.log('✓ Test 4 passed: Classified as MEH (' + Math.round(res4.confidence * 100) + '%)\n');

  // Test 5: Cache hit verification
  console.log('Test 5: Cache hit verification...');
  const res3Cached = await classifyPost(slopPost, false);
  assert.strictEqual(res3Cached.cached, true, 'Expected result to be marked as cached');
  console.log('✓ Test 5 passed: Cache hit successfully verified\n');

  // Test 6: DOM Tweet ID extraction logic
  console.log('Test 6: Tweet ID extraction verification...');
  const testHref = '/sama/status/1888291029103982019';
  const match = testHref.match(/\/status\/(\d+)/);
  assert.ok(match && match[1] === '1888291029103982019', 'Tweet status ID failed to extract');
  console.log('✓ Test 5 passed: Tweet ID regex extracted ' + match[1] + '\n');

  console.log('🎉 All automated tests passed successfully!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
