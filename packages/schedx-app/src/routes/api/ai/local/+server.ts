// @ts-ignore - Temporary bypass for $env module
import { env } from '$env/dynamic/private';
import type { RequestHandler } from '@sveltejs/kit';

import { LlamaModel, LlamaContext, LlamaChatSession } from 'node-llama-cpp';

type RequestBody = {
  prompt: string;
  tone: string;
  length: string;
};

const modelPath = env.LOCAL_AI_MODEL || './static/models/tinyllama.gguf';
const model = new LlamaModel({ modelPath });
const context = new LlamaContext({ model });
const session = new LlamaChatSession({ context });

export const POST: RequestHandler = async ({ request }) => {
  if (env.USE_LOCAL_AI !== 'true') {
    return new Response('Local AI disabled', { status: 501 });
  }

  const { prompt, tone, length } = await request.json() as RequestBody;
  
  const response = await session.prompt(
    `Generate a ${tone} tweet (${length}): ${prompt}\n\nTweet:`,
    {
      temperature: parseFloat(env.LOCAL_AI_TEMPERATURE || '0.8'),
      maxTokens: parseInt(env.LOCAL_AI_MAX_TOKENS || '120')
    }
  );

  return new Response(response.trim());
};
