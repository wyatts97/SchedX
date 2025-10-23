import { getEnvironmentConfig } from '$lib/server/env';

const env = getEnvironmentConfig();

export async function generateTweet(prompt: string, tone: string, length: string): Promise<string> {
  try {
    if (env.USE_LOCAL_AI !== 'true') {
      throw new Error('Local AI is disabled in environment settings');
    }

    const res = await fetch('/api/ai/local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, tone, length })
    });
    
    if (!res.ok) {
      const error = await res.text().catch(() => 'Unknown error');
      throw new Error(`Local AI request failed (${res.status}): ${error}`);
    }
    
    return await res.text();
  } catch (error) {
    console.error('AI generation error:', error instanceof Error ? error.message : error);
    throw new Error('Failed to generate tweet. Please try again later.');
  }
}
