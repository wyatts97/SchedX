import { getEnvironmentConfig } from '$lib/server/env';
import { InferenceSession, Tensor } from 'onnxruntime-node';
import type { RequestHandler } from '@sveltejs/kit';
// @ts-ignore - SvelteKit env import
import { env } from '$env/dynamic/private';

// Initialize ONNX session
const session = await InferenceSession.create('./static/models/distilgpt2.onnx');

type RequestBody = {
  prompt: string;
  tone: string;
  length: string;
};

const envConfig = getEnvironmentConfig();

export const POST: RequestHandler = async ({ request }) => {
  if (env.USE_LOCAL_AI !== 'true') {
    return new Response('Local AI disabled', { 
      status: 501,
      headers: { 'Cache-Control': 'no-store' }
    });
  }

  try {
    const { prompt, tone, length } = (await request.json()) as RequestBody;

    // Prepare inputs
    const inputs = new Tensor('string', [
      `Generate a ${tone} tweet (${length}): ${prompt}\n\nTweet:`
    ]);

    // Run inference
    const { output } = await session.run({ inputs });

    return new Response(output.data[0].toString().trim());
  } catch (error) {
    console.error('AI generation failed:', error);
    return new Response('AI service unavailable', { status: 500 });
  }
};
