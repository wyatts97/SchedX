import { getEnvironmentConfig } from '$lib/server/env';

const env = getEnvironmentConfig();

export async function generateTweet(prompt: string, tone: string, length: string): Promise<string> {
  const res = await fetch('/api/ai/local', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, tone, length })
  });
  return await res.text();
}
