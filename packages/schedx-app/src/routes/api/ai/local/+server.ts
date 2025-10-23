import { getEnvironmentConfig } from '$lib/server/env';
import type { RequestHandler } from '@sveltejs/kit';
import { pipeline, env as transformerEnv } from '@xenova/transformers';

// Skip local model check
transformerEnv.allowLocalModels = false;

type RequestBody = {
prompt: string;
tone: string;
length: string;
};

// Create a singleton instance of the text generation pipeline
const generator = await pipeline('text-generation', 'Xenova/tinyllama');
const env = getEnvironmentConfig();

export const POST: RequestHandler = async ({ request }) => {
if (process.env.USE_LOCAL_AI !== 'true') {
return new Response('Local AI disabled', { status: 501 });
}

try {
const { prompt, tone, length } = (await request.json()) as RequestBody;

const response = await generator(
  `Generate a ${tone} tweet (${length}): ${prompt}\n\nTweet:`,
  {
    temperature: parseFloat(process.env.LOCAL_AI_TEMPERATURE || '0.8'),
    max_new_tokens: parseInt(process.env.LOCAL_AI_MAX_TOKENS || '120'),
    repetition_penalty: 1.5,
    no_repeat_ngram_size: 2
  }
);

// @ts-ignore
return new Response(response[0].generated_text.trim());

} catch (error) {
console.error('AI generation error:', error);
return new Response('Failed to generate tweet', { status: 500 });
}
};
