// @ts-ignore - Temporary bypass for $env module
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

let localAISettings = {
  enabled: env.USE_LOCAL_AI === 'true',
  temperature: parseFloat(env.LOCAL_AI_TEMPERATURE || '0.8'),
  maxTokens: parseInt(env.LOCAL_AI_MAX_TOKENS || '120')
};

export const GET: RequestHandler = async () => {
  return json(localAISettings);
};

export const POST: RequestHandler = async ({ request }) => {
  const settings = await request.json();
  
  // Update in-memory settings
  localAISettings = {
    enabled: settings.enabled,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens
  };
  
  // Update environment variables
  env.USE_LOCAL_AI = settings.enabled ? 'true' : 'false';
  env.LOCAL_AI_TEMPERATURE = settings.temperature.toString();
  env.LOCAL_AI_MAX_TOKENS = settings.maxTokens.toString();
  
  return json({ success: true });
};
