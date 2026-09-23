import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { classifyPost, clearCache } from './jev.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8787', 10);
const isDebug = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

// Middleware
app.use(cors({
  origin: '*', // Allow extension to connect from chrome-extension:// origins
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '100kb' }));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'jev-judge-backend',
    timestamp: new Date().toISOString()
  });
});

// Running session stats
let totalPostsClassified = 0;
let totalSpend = 0;

// Reset session cache endpoint
app.post('/api/reset', (_req: Request, res: Response) => {
  clearCache();
  totalPostsClassified = 0;
  totalSpend = 0;
  if (isDebug) {
    console.log('[JEV] Cache and session counters reset via /api/reset');
  }
  res.json({ status: 'ok', message: 'Cache and session metrics cleared successfully' });
});

// Classification endpoint
app.post('/api/classify', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { text } = req.body || {};

  // 1. Validation
  if (!text || typeof text !== 'string') {
    return res.status(400).json({
      error: 'Invalid request: "text" field is required and must be a non-empty string.'
    });
  }

  const trimmedText = text.trim();
  if (trimmedText.length === 0) {
    return res.status(400).json({
      error: 'Invalid request: "text" cannot be empty or whitespace only.'
    });
  }

  if (trimmedText.length > 20000) {
    return res.status(413).json({
      error: 'Payload too large: "text" must not exceed 20,000 characters.'
    });
  }

  // 2. Format a clean preview snippet for demo logging
  const preview = trimmedText.replace(/\s+/g, ' ').slice(0, 50);
  const snippet = preview.length === 50 ? `"${preview}..."` : `"${preview}"`;

  console.log(`[JEV] Judging post: ${snippet}`);

  try {
    const result = await classifyPost(trimmedText, isDebug);
    const totalDuration = Date.now() - startTime;

    // Format category for terminal presentation
    const categoryUpper = result.category.toUpperCase().replace('_', ' ');
    const percent = Math.round(result.confidence * 100);

    totalPostsClassified++;
    totalSpend += (result.cost || 0.000014);

    // Clean demo logging requested for YouTube presentation
    const providerTag = result.provider ? ` · ${result.provider}` : '';
    console.log(`[JEV] → ${categoryUpper} (${percent}%)${providerTag}`);
    console.log(`[JEV] ${result.cached ? 'cached · ' : ''}${totalDuration}ms · $${(result.cost || 0.000014).toFixed(6)} (Total: ${totalPostsClassified} posts · $${totalSpend.toFixed(5)})`);

    if (isDebug) {
      console.log(`[JEV] Probabilities: BREAKING=${result.probabilities.breaking} | GOLDEN_NUGGET=${result.probabilities.golden_nugget} | MEH=${result.probabilities.meh} | AI_SLOP=${result.probabilities.ai_slop}`);
    }

    return res.json({
      category: result.category,
      confidence: result.confidence,
      probabilities: result.probabilities,
      cost: result.cost || 0.000014,
      totalSpend: Number(totalSpend.toFixed(5)),
      totalPosts: totalPostsClassified
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[JEV] Classification failed after ${duration}ms: ${error.message || 'Unknown error'}`);

    return res.status(502).json({
      error: 'Failed to classify post with Jev',
      details: error.message || 'Upstream error'
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  const provider = process.env.TYPESAFE_API_KEY ? 'TypeSafe AI (Direct)'
    : process.env.OPENROUTER_API_KEY ? 'OpenRouter (Jev)'
    : process.env.GROQ_API_KEY ? 'Groq (Llama 3.3)'
    : process.env.OPENAI_API_KEY ? 'OpenAI (GPT-4o-mini)'
    : 'Local Demo Mock Mode (No API key needed)';

  console.log('='.repeat(50));
  console.log(`  Jev Judge Backend running on http://localhost:${PORT}`);
  console.log(`  Active Provider: ${provider}`);
  console.log(`  Debug:           ${isDebug ? 'Enabled' : 'Disabled'}`);
  console.log('='.repeat(50));
});
