import { log } from '$lib/server/logger';
import { getDbInstance } from '$lib/server/db';

export type TweetTone = 'casual' | 'professional' | 'funny' | 'inspirational' | 'informative';
export type TweetLength = 'short' | 'medium' | 'long';

interface GenerateTweetOptions {
	prompt: string;
	tone?: TweetTone;
	length?: TweetLength;
	context?: string;
	userId?: string;
}

interface OpenRouterResponse {
	choices?: Array<{
		message: {
			content: string;
		};
	}>;
	error?: {
		message: string;
	};
}

/**
 * AI Service for generating tweet content using OpenRouter
 * Retrieves API key from database settings
 */
export class AIService {
	private static instance: AIService;
	private readonly openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
	private db = getDbInstance();

	private constructor() {}

	static getInstance(): AIService {
		if (!AIService.instance) {
			AIService.instance = new AIService();
		}
		return AIService.instance;
	}

	/**
	 * Generate a tweet based on user prompt and preferences
	 */
	async generateTweet(options: GenerateTweetOptions): Promise<string> {
		const { prompt, tone = 'casual', length = 'medium', context, userId = 'admin' } = options;

		// Get OpenRouter settings from database
		const settings = await this.db.getOpenRouterSettings(userId);
		
		if (!settings || !settings.enabled) {
			throw new Error('OpenRouter AI is not configured. Please add your API key in settings.');
		}

		if (!settings.apiKey) {
			throw new Error('OpenRouter API key is missing. Please configure it in settings.');
		}

		const systemPrompt = this.buildSystemPrompt(tone, length);
		const userPrompt = context ? `${prompt}\n\nContext: ${context}` : prompt;

		log.info('Generating tweet with OpenRouter', {
			tone,
			length,
			hasContext: !!context,
			promptLength: prompt.length,
			model: settings.defaultModel
		});

		try {
			const generatedText = await this.callOpenRouter(
				settings.apiKey,
				settings.defaultModel,
				systemPrompt,
				userPrompt
			);
			const cleanedTweet = this.cleanAndValidateTweet(generatedText, length);
			
			log.info('Tweet generated successfully with OpenRouter', {
				outputLength: cleanedTweet.length,
				model: settings.defaultModel
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
		const toneInstructions = {
			casual: 'Write in a friendly, conversational tone. Use natural language.',
			professional: 'Write in a professional, polished tone. Be clear and authoritative.',
			funny: 'Write in a humorous, witty tone. Be clever and entertaining.',
			inspirational: 'Write in an uplifting, motivational tone. Be positive and encouraging.',
			informative: 'Write in an educational, informative tone. Be clear and factual.'
		};

		const lengthInstructions = {
			short: 'Keep it brief and punchy (under 100 characters).',
			medium: 'Use a moderate length (100-180 characters).',
			long: 'Use the full space available (up to 280 characters).'
		};

		return `You are a social media expert writing tweets for Twitter/X. ${toneInstructions[tone]} ${lengthInstructions[length]}

Rules:
- Write ONLY the tweet text, nothing else
- Do NOT include hashtags unless specifically requested
- Do NOT include quotes around the tweet
- Do NOT include "Tweet:" or similar prefixes
- Keep it under 280 characters
- Make it engaging and authentic
- Use emojis sparingly and only when appropriate`;
	}

	/**
	 * Call OpenRouter API
	 */
	private async callOpenRouter(
		apiKey: string,
		model: string,
		systemPrompt: string,
		userPrompt: string
	): Promise<string> {
		const response = await fetch(this.openRouterUrl, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://schedx.app',
				'X-Title': 'SchedX'
			},
			body: JSON.stringify({
				model,
				messages: [
					{
						role: 'system',
						content: systemPrompt
					},
					{
						role: 'user',
						content: userPrompt
					}
				],
				temperature: 0.7,
				max_tokens: 150
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			log.error('OpenRouter API error', {
				status: response.status,
				error: errorText
			});
			
			if (response.status === 401) {
				throw new Error('Invalid OpenRouter API key. Please check your settings.');
			}
			
			if (response.status === 429) {
				throw new Error('Rate limit exceeded. Please try again later.');
			}
			
			throw new Error(`AI service error: ${response.status}`);
		}

		const data = await response.json() as OpenRouterResponse;
		
		if (data.choices && data.choices.length > 0 && data.choices[0].message?.content) {
			return data.choices[0].message.content;
		}
		
		if (data.error) {
			throw new Error(data.error.message || 'Unknown API error');
		}
		
		throw new Error('Unexpected response format from OpenRouter API');
	}

	/**
	 * Clean and validate the generated tweet
	 */
	private cleanAndValidateTweet(text: string, length: TweetLength): string {
		// Remove common prefixes
		let cleaned = text
			.replace(/^(Tweet:|Here's a tweet:|Here's the tweet:)/i, '')
			.trim();

		// Remove quotes if the entire text is quoted
		if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
			cleaned = cleaned.slice(1, -1).trim();
		}
		if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
			cleaned = cleaned.slice(1, -1).trim();
		}

		// Remove any trailing explanations (text after newlines)
		const firstNewline = cleaned.indexOf('\n');
		if (firstNewline > 0) {
			cleaned = cleaned.substring(0, firstNewline).trim();
		}

		// Ensure it's under 280 characters
		if (cleaned.length > 280) {
			// Try to cut at a sentence or word boundary
			const cutPoint = cleaned.lastIndexOf('.', 280);
			if (cutPoint > 200) {
				cleaned = cleaned.substring(0, cutPoint + 1).trim();
			} else {
				const spacePoint = cleaned.lastIndexOf(' ', 280);
				cleaned = cleaned.substring(0, spacePoint > 0 ? spacePoint : 280).trim() + '...';
			}
		}

		// Validate minimum length
		if (cleaned.length < 10) {
			throw new Error('Generated tweet is too short. Please try again.');
		}

		return cleaned;
	}

	/**
	 * Check if OpenRouter is configured for a user
	 */
	async isConfigured(userId: string = 'admin'): Promise<boolean> {
		try {
			const settings = await this.db.getOpenRouterSettings(userId);
			return !!(settings && settings.enabled && settings.apiKey);
		} catch {
			return false;
		}
	}
}
