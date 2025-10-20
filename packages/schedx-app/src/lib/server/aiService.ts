import { log } from '$lib/server/logger';

export type TweetTone = 'casual' | 'professional' | 'funny' | 'inspirational' | 'informative';
export type TweetLength = 'short' | 'medium' | 'long';

interface GenerateTweetOptions {
	prompt: string;
	tone?: TweetTone;
	length?: TweetLength;
	context?: string;
}

interface PuterAIResponse {
	message?: {
		content: string;
	};
	error?: string;
}

/**
 * AI Service for generating tweet content using Grok via Puter.js
 * Uses free, no-API-key-required Grok models through Puter's "User Pays" model
 */
export class AIService {
	private static instance: AIService;
	private readonly puterApiUrl = 'https://api.puter.com/drivers/call';
	// Using Grok-4-fast for best speed/quality balance
	private readonly model = 'x-ai/grok-4-fast:free';

	private constructor() {}

	static getInstance(): AIService {
		if (!AIService.instance) {
			AIService.instance = new AIService();
		}
		return AIService.instance;
	}

	/**
	 * Generate tweet content based on user prompt
	 */
	async generateTweet(options: GenerateTweetOptions): Promise<string> {
		const { prompt, tone = 'casual', length = 'medium', context } = options;

		// Build the system prompt
		const systemPrompt = this.buildSystemPrompt(tone, length);
		
		// Build the full prompt
		const fullPrompt = this.buildFullPrompt(systemPrompt, prompt, context);

		log.info('Generating tweet with AI', {
			tone,
			length,
			hasContext: !!context,
			promptLength: prompt.length
		});

		try {
			const generatedText = await this.callGrokViaPuter(fullPrompt);
			const cleanedTweet = this.cleanAndValidateTweet(generatedText, length);
			
			log.info('Tweet generated successfully with Grok', {
				outputLength: cleanedTweet.length
			});

			return cleanedTweet;
		} catch (error) {
			log.error('Failed to generate tweet with Grok', {
				error: error instanceof Error ? error.message : String(error)
			});
			throw new Error('Failed to generate tweet. Please try again.');
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
	 * Build the full prompt for the model
	 */
	private buildFullPrompt(systemPrompt: string, userPrompt: string, context?: string): string {
		let prompt = `${systemPrompt}\n\nUser request: ${userPrompt}`;
		
		if (context) {
			prompt += `\n\nAdditional context: ${context}`;
		}

		prompt += '\n\nTweet:';
		
		return prompt;
	}

	/**
	 * Call Puter.js AI API with Grok
	 */
	private async callGrokViaPuter(prompt: string): Promise<string> {
		const response = await fetch(this.puterApiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				interface: 'puter-chat-completion',
				driver: 'openrouter',
				method: 'complete',
				args: {
					messages: [
						{
							role: 'user',
							content: prompt
						}
					],
					model: this.model,
					temperature: 0.7,
					max_tokens: 150
				}
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			log.error('Puter/Grok API error', {
				status: response.status,
				error: errorText
			});
			
			throw new Error(`AI service error: ${response.status}`);
		}

		const data = await response.json() as PuterAIResponse;
		
		if (data.message?.content) {
			return data.message.content;
		}
		
		if (data.error) {
			throw new Error(data.error);
		}
		
		throw new Error('Unexpected response format from Puter API');
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
	 * Check if the AI service is available
	 */
	async healthCheck(): Promise<boolean> {
		try {
			const response = await fetch(this.puterApiUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					interface: 'puter-chat-completion',
					driver: 'openrouter',
					method: 'complete',
					args: {
						messages: [{ role: 'user', content: 'test' }],
						model: this.model,
						max_tokens: 5
					}
				})
			});
			return response.ok;
		} catch {
			return false;
		}
	}
}
