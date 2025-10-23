import { log } from '$lib/server/logger';

export type TweetTone = 'casual' | 'professional' | 'funny' | 'inspirational' | 'informative';
export type TweetLength = 'short' | 'medium' | 'long';

interface GenerateTweetOptions {
	prompt: string;
	tone?: TweetTone;
	length?: TweetLength;
	context?: string;
	userId?: string;
}

interface OpenRouterSettings {
	apiKey: string;
	model: string;
	temperature: number;
	maxTokens: number;
}

/**
 * AI Service for generating tweet content using OpenRouter API
 */
export class OpenRouterService {
	private static instance: OpenRouterService;
	private baseUrl = 'https://openrouter.ai/api/v1/chat/completions';

	private constructor() {}

	static getInstance(): OpenRouterService {
		if (!OpenRouterService.instance) {
			OpenRouterService.instance = new OpenRouterService();
		}
		return OpenRouterService.instance;
	}

	/**
	 * Generate a tweet using OpenRouter API
	 */
	async generateTweet(
		options: GenerateTweetOptions,
		settings: OpenRouterSettings
	): Promise<string> {
		const { prompt, tone = 'casual', length = 'medium', context } = options;

		const systemPrompt = this.buildSystemPrompt(tone, length);
		const userPrompt = context 
			? `Context: ${context}\n\nPrompt: ${prompt}`
			: prompt;

		log.info('Generating tweet with OpenRouter', {
			model: settings.model,
			tone,
			length,
			hasContext: !!context,
			promptLength: prompt.length
		});

		try {
			const response = await fetch(this.baseUrl, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${settings.apiKey}`,
					'Content-Type': 'application/json',
					'HTTP-Referer': 'https://schedx.app',
					'X-Title': 'SchedX'
				},
				body: JSON.stringify({
					model: settings.model,
					messages: [
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: userPrompt }
					],
					temperature: settings.temperature,
					max_tokens: settings.maxTokens
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error?.message || `OpenRouter API error: ${response.status}`);
			}

			const data = await response.json();
			const generatedText = data.choices[0]?.message?.content || '';
			
			if (!generatedText) {
				throw new Error('No content generated from OpenRouter');
			}

			const cleanedTweet = this.cleanAndValidateTweet(generatedText, length);
			
			log.info('Tweet generated successfully with OpenRouter', {
				outputLength: cleanedTweet.length
			});

			return cleanedTweet;
		} catch (error) {
			log.error('Failed to generate tweet with OpenRouter', {
				error: error instanceof Error ? error.message : String(error)
			});
			throw new Error(error instanceof Error ? error.message : 'Failed to generate tweet. Please try again.');
		}
	}

	/**
	 * Build system prompt based on tone and length
	 */
	private buildSystemPrompt(tone: TweetTone, length: TweetLength): string {
		const toneDescriptions = {
			casual: 'friendly and conversational',
			professional: 'polished and business-appropriate',
			funny: 'humorous and entertaining',
			inspirational: 'motivating and uplifting',
			informative: 'educational and fact-based'
		};

		const lengthLimits = {
			short: '100 characters or less',
			medium: '150-200 characters',
			long: '250-280 characters'
		};

		return `You are a professional social media content creator specializing in Twitter/X posts.

Generate a ${toneDescriptions[tone]} tweet that is ${lengthLimits[length]}.

Requirements:
- Stay within Twitter's 280 character limit
- Be engaging and authentic
- Use appropriate hashtags sparingly (1-2 max)
- Avoid emojis unless they add value
- Make it shareable and conversation-starting
- Return ONLY the tweet text, no explanations or quotes`;
	}

	/**
	 * Clean and validate the generated tweet
	 */
	private cleanAndValidateTweet(text: string, length: TweetLength): string {
		// Remove quotes if the model wrapped the tweet
		let cleaned = text.trim().replace(/^["']|["']$/g, '');

		// Remove any meta-commentary
		cleaned = cleaned.split('\n')[0].trim();

		// Ensure it's within Twitter's limit
		if (cleaned.length > 280) {
			cleaned = cleaned.substring(0, 277) + '...';
		}

		// Validate minimum length
		if (cleaned.length < 10) {
			throw new Error('Generated tweet is too short');
		}

		return cleaned;
	}

	/**
	 * Test API key validity
	 */
	async testApiKey(apiKey: string): Promise<boolean> {
		try {
			const response = await fetch(this.baseUrl, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
					'HTTP-Referer': 'https://schedx.app',
					'X-Title': 'SchedX'
				},
				body: JSON.stringify({
					model: 'openai/gpt-3.5-turbo',
					messages: [{ role: 'user', content: 'test' }],
					max_tokens: 5
				})
			});

			return response.ok;
		} catch (error) {
			log.error('API key test failed', { error });
			return false;
		}
	}
}
