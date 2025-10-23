import { InferenceSession, Tensor } from 'onnxruntime-node';
import type { RequestHandler } from '@sveltejs/kit';
import { join } from 'path';
import { existsSync } from 'fs';
// @ts-ignore - SvelteKit env import
import { env } from '$env/dynamic/private';

type RequestBody = {
  prompt: string;
  tone: string;
  length: string;
};

let session: InferenceSession | null = null;
let modelInitialized = false;

async function initializeModel(): Promise<void> {
  if (modelInitialized) return;
  
  const modelPath = join(process.cwd(), 'packages', 'schedx-app', 'static', 'models', 'distilgpt2.onnx');
  
  if (!existsSync(modelPath)) {
    console.warn(`ONNX model not found at ${modelPath}`);
    modelInitialized = true;
    return;
  }

  try {
    session = await InferenceSession.create(modelPath);
    console.log('ONNX model loaded successfully');
  } catch (err) {
    console.error('Failed to load ONNX model:', err);
  }
  
  modelInitialized = true;
}

export const POST: RequestHandler = async ({ request }) => {
  // Check environment variable at runtime, not build time
  if (env.USE_LOCAL_AI !== 'true') {
    return new Response(JSON.stringify({ error: 'Local AI disabled' }), { 
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Initialize model on first request
  if (!modelInitialized) {
    await initializeModel();
  }

  if (!session) {
    return new Response(JSON.stringify({ error: 'AI model not available' }), { 
      status: 503,
      headers: { 'Content-Type': 'application/json' }
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

    return new Response(JSON.stringify({ 
      tweet: output.data[0].toString().trim() 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('AI generation failed:', error);
    return new Response(JSON.stringify({ error: 'AI service unavailable' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
