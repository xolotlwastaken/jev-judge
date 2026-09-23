import crypto from 'node:crypto';

export type Category = 'breaking' | 'golden_nugget' | 'ai_slop' | 'meh';

export interface JevClassificationResult {
  category: Category;
  confidence: number;
  probabilities: {
    breaking: number;
    golden_nugget: number;
    meh: number;
    ai_slop: number;
  };
  cost: number;
  cached?: boolean;
  latencyMs?: number;
  provider?: string;
}

const SYSTEMONE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const OPENROUTER_DECISIONS_ENDPOINT = 'https://openrouter.ai/api/alpha/decisions';
const JEV_MODEL = 'jev-latest';
const OPENROUTER_JEV_MODEL = '~typesafe/jev-latest';

// In-memory cache for classifications to avoid duplicate API calls
const cache = new Map<string, JevClassificationResult>();

function getPostHash(text: string): string {
  return crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
}

/**
 * Classifies an X post using available providers in order:
 * 1. TypeSafe AI Direct (TYPESAFE_API_KEY)
 * 2. OpenRouter Jev (OPENROUTER_API_KEY) — real Jev model without waitlist!
 * 3. Groq (GROQ_API_KEY) — ultra-fast ~150ms
 * 4. OpenAI (OPENAI_API_KEY) — gpt-4o-mini
 * 5. Local Demo Mock Mode — offline simulation for YouTube recording
 */
export async function classifyPost(text: string, isDebug: boolean = false): Promise<JevClassificationResult> {
  const postHash = getPostHash(text);

  // Check cache first
  if (cache.has(postHash)) {
    const cachedResult = cache.get(postHash)!;
    if (isDebug) {
      console.log(`[JEV] Cache HIT for hash ${postHash.slice(0, 8)}`);
    }
    return { ...cachedResult, cached: true };
  }

  const typesafeKey = process.env.TYPESAFE_API_KEY?.trim();
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  const startTime = Date.now();

  // 1. Direct TypeSafe API if key provided and not placeholder
  if (typesafeKey && typesafeKey !== 'your_typesafe_api_key_here' && typesafeKey !== 'mock') {
    try {
      const res = await callSystemOneJev(SYSTEMONE_ENDPOINT, JEV_MODEL, typesafeKey, text);
      const latencyMs = Date.now() - startTime;
      const finalResult = { ...res, latencyMs, provider: 'TypeSafe AI', cached: false };
      cache.set(postHash, finalResult);
      return finalResult;
    } catch (err: any) {
      if (isDebug) console.warn('[JEV] TypeSafe direct call failed, checking fallbacks:', err.message);
    }
  }

  // 2. OpenRouter Jev (Accesses real Jev without waitlist!)
  if (openrouterKey && openrouterKey !== 'your_openrouter_api_key_here') {
    try {
      const res = await callSystemOneJev(OPENROUTER_DECISIONS_ENDPOINT, OPENROUTER_JEV_MODEL, openrouterKey, text);
      const latencyMs = Date.now() - startTime;
      const finalResult = { ...res, latencyMs, provider: 'OpenRouter (Jev)', cached: false };
      cache.set(postHash, finalResult);
      return finalResult;
    } catch (err: any) {
      if (isDebug) console.warn('[JEV] OpenRouter Jev call failed, checking fallbacks:', err.message);
    }
  }

  // 3. Groq (Ultra-fast Llama 3.3 70B ~150ms)
  if (groqKey && groqKey !== 'your_groq_api_key_here') {
    try {
      const res = await callOpenAICompatible(
        'https://api.groq.com/openai/v1/chat/completions',
        'llama-3.3-70b-versatile',
        groqKey,
        text
      );
      const latencyMs = Date.now() - startTime;
      const finalResult = { ...res, latencyMs, provider: 'Groq', cached: false };
      cache.set(postHash, finalResult);
      return finalResult;
    } catch (err: any) {
      if (isDebug) console.warn('[JEV] Groq call failed:', err.message);
    }
  }

  // 4. OpenAI (GPT-4o-mini)
  if (openaiKey && openaiKey !== 'your_openai_api_key_here') {
    try {
      const res = await callOpenAICompatible(
        'https://api.openai.com/v1/chat/completions',
        'gpt-4o-mini',
        openaiKey,
        text
      );
      const latencyMs = Date.now() - startTime;
      const finalResult = { ...res, latencyMs, provider: 'OpenAI', cached: false };
      cache.set(postHash, finalResult);
      return finalResult;
    } catch (err: any) {
      if (isDebug) console.warn('[JEV] OpenAI call failed:', err.message);
    }
  }

  // 5. Intelligent Local Demo Mock Mode (Zero key needed, offline ready)
  if (isDebug) {
    console.log('[JEV] [DEMO MODE] Running simulated Jev classification...');
  }
  const mockResult = simulateJevClassification(text);
  const latencyMs = Date.now() - startTime;
  const finalResult = { ...mockResult, latencyMs, provider: 'Local Demo', cached: false };
  cache.set(postHash, finalResult);
  return finalResult;
}

/**
 * Call TypeSafe / OpenRouter Decisions API
 */
async function callSystemOneJev(endpoint: string, model: string, apiKey: string, text: string) {
  const payload = {
    model,
    state: {
      post: text
    },
    questions: {
      category: {
        type: 'choice',
        instructions: 'Classify this X post based on how valuable it is to someone who follows AI, technology, startups, coding and AI tools.',
        criteria: {
          breaking: 'Genuinely new and important information, such as a major AI model release, product launch, company announcement, important research result, acquisition, major update, or significant breaking development.',
          golden_nugget: 'Useful, insightful or educational content. This includes practical advice, tutorials, interesting observations, useful tools, strong opinions backed by reasoning, useful data, workflows, prompts, resources, or ideas worth saving.',
          meh: 'Average, mundane, casual or ordinary social media content. Routine personal updates, casual banter, everyday remarks, or casual chatter that is neither high-value nor blatant AI slop.',
          ai_slop: 'Low-value content, generic AI hype, recycled information, engagement bait, vague motivational posts, obvious clickbait, content that says very little, or posts designed primarily to farm impressions.'
        }
      }
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error response body');
      throw new Error(`API responded with status ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as any;
    const categoryAnswer = data?.answers?.category;
    if (!categoryAnswer) {
      throw new Error('API response missing answers.category');
    }

    const rawChoice = (categoryAnswer.choice || categoryAnswer.value || 'meh').toLowerCase();
    let category: Category = 'meh';
    if (rawChoice.includes('breaking')) category = 'breaking';
    else if (rawChoice.includes('golden')) category = 'golden_nugget';
    else if (rawChoice.includes('slop')) category = 'ai_slop';
    else if (rawChoice.includes('meh')) category = 'meh';

    const confidence = typeof categoryAnswer.confidence === 'number'
      ? Math.min(Math.max(categoryAnswer.confidence, 0.5), 0.99)
      : 0.92;

    const rawProbs = categoryAnswer.probabilities || {};
    const probabilities = {
      breaking: typeof rawProbs.breaking === 'number' ? rawProbs.breaking : (category === 'breaking' ? confidence : 0.02),
      golden_nugget: typeof rawProbs.golden_nugget === 'number' ? rawProbs.golden_nugget : (category === 'golden_nugget' ? confidence : 0.02),
      meh: typeof rawProbs.meh === 'number' ? rawProbs.meh : (category === 'meh' ? confidence : 0.02),
      ai_slop: typeof rawProbs.ai_slop === 'number' ? rawProbs.ai_slop : (category === 'ai_slop' ? confidence : 0.02)
    };

    const rawCost = typeof data?.usage?.cost === 'number'
      ? data.usage.cost
      : Number((((data?.usage?.input_tokens || Math.ceil(text.length / 4) + 180) * 0.042) / 1_000_000).toFixed(7));

    return {
      category,
      confidence: Number(confidence.toFixed(2)),
      probabilities: {
        breaking: Number(probabilities.breaking.toFixed(2)),
        golden_nugget: Number(probabilities.golden_nugget.toFixed(2)),
        meh: Number(probabilities.meh.toFixed(2)),
        ai_slop: Number(probabilities.ai_slop.toFixed(2))
      },
      cost: rawCost
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Call standard OpenAI/Groq compatible chat completion with JSON mode
 */
async function callOpenAICompatible(endpoint: string, model: string, apiKey: string, text: string) {
  const prompt = `You are Jev, a high-speed post classifier.
Classify the following post into EXACTLY one category:
- "breaking": Major AI model releases, product launches, research breakthroughs, or company acquisitions.
- "golden_nugget": Deep technical tutorials, practical code snippets, benchmarks, or actionable workflows worth bookmarking.
- "meh": Average, mundane, casual or ordinary social media content, everyday banter, routine observations that are neither high-value nor blatant AI slop.
- "ai_slop": Generic hype threads, recycled platitudes, or low-information engagement bait.

Post text:
"""
${text}
"""

Return JSON format:
{
  "category": "breaking" | "golden_nugget" | "meh" | "ai_slop",
  "confidence": 0.92,
  "probabilities": { "breaking": 0.03, "golden_nugget": 0.03, "meh": 0.90, "ai_slop": 0.04 }
}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);

    const category: Category = ['breaking', 'golden_nugget', 'meh', 'ai_slop'].includes(parsed.category)
      ? parsed.category
      : 'meh';

    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.91;
    const rawProbs = parsed.probabilities || {};

    const promptTokens = data?.usage?.prompt_tokens || Math.ceil(text.length / 4) + 120;
    const completionTokens = data?.usage?.completion_tokens || 35;
    const calcCost = Number(((promptTokens * 0.00000015) + (completionTokens * 0.0000006)).toFixed(7));

    return {
      category,
      confidence: Number(confidence.toFixed(2)),
      probabilities: {
        breaking: typeof rawProbs.breaking === 'number' ? Number(rawProbs.breaking.toFixed(2)) : (category === 'breaking' ? confidence : 0.03),
        golden_nugget: typeof rawProbs.golden_nugget === 'number' ? Number(rawProbs.golden_nugget.toFixed(2)) : (category === 'golden_nugget' ? confidence : 0.03),
        meh: typeof rawProbs.meh === 'number' ? Number(rawProbs.meh.toFixed(2)) : (category === 'meh' ? confidence : 0.03),
        ai_slop: typeof rawProbs.ai_slop === 'number' ? Number(rawProbs.ai_slop.toFixed(2)) : (category === 'ai_slop' ? confidence : 0.03)
      },
      cost: calcCost
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Intelligent local fallback classifier for demos or offline testing.
 */
function simulateJevClassification(text: string): JevClassificationResult {
  const lower = text.toLowerCase();

  const breakingTriggers = [
    'announcing', 'announced', 'introducing', 'just released', 'release v', 'releases',
    'breaking:', 'launching', 'we just launched', 'paper is out', 'acquired', 'acquisition',
    'gpt-5', 'claude 3.7', 'claude 4', 'llama 4', 'gemini 2.5', 'weights are available',
    'open weights', 'open source release', 'funding round', 'series a', 'series b'
  ];

  const goldenTriggers = [
    'how to', 'guide', 'tutorial', 'tip:', 'pro tip', 'lesson', 'architecture', 'github repo',
    'code snippet', 'system prompt', 'evals', 'benchmark', 'step-by-step', 'here is why',
    'here is how', 'framework', 'workflow', 'cheatsheet', 'learned after', 'takeaways'
  ];

  const slopTriggers = [
    'agree?', 'thoughts?', '10x engineer', 'will replace all', 'in 6 months developers won\'t exist',
    'bookmark this', 'drop a comment', 'follow me for more', 'ai will change everything',
    'most people have no idea', '99% of people are sleeping', 'chatgpt prompt', 'supercharge'
  ];

  const mehTriggers = [
    'good morning', 'gm', 'gn', 'coffee', 'weekend', 'lunch', 'dinner', 'just had',
    'today i', 'anyone know', 'what do you think of this weather', 'lol', 'haha', 'tbh',
    'bored', 'heading out', 'random thought', 'feeling like'
  ];

  let category: Category = 'meh';
  let confidence = 0.86;

  if (breakingTriggers.some(trigger => lower.includes(trigger))) {
    category = 'breaking';
    confidence = 0.94;
  } else if (slopTriggers.some(trigger => lower.includes(trigger))) {
    category = 'ai_slop';
    confidence = 0.91;
  } else if (goldenTriggers.some(trigger => lower.includes(trigger))) {
    category = 'golden_nugget';
    confidence = 0.89;
  } else if (mehTriggers.some(trigger => lower.includes(trigger))) {
    category = 'meh';
    confidence = 0.88;
  } else {
    if (text.length < 80 && !text.includes('http')) {
      category = 'meh';
      confidence = 0.84;
    } else {
      category = 'golden_nugget';
      confidence = 0.85;
    }
  }

  const remainder = Number(((1 - confidence) / 3).toFixed(2));
  return {
    category,
    confidence,
    probabilities: {
      breaking: category === 'breaking' ? confidence : remainder,
      golden_nugget: category === 'golden_nugget' ? confidence : remainder,
      meh: category === 'meh' ? confidence : remainder,
      ai_slop: category === 'ai_slop' ? confidence : remainder
    },
    cost: 0.000014
  };
}

export function clearCache(): void {
  cache.clear();
}
