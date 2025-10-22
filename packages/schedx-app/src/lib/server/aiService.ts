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
		code?: string;
	};
}

interface CacheEntry {
	tweet: string;
	timestamp: number;
	model: string;
}

/**
 * AI Service for generating tweet content using OpenRouter
 * Retrieves API key from database settings
 * Features: Model fallback, retry logic, caching, usage tracking
 */
export class AIService {
	private static instance: AIService;
	private readonly openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
	private db = getDbInstance();
	
	// Model fallback priority (all free models)
	private readonly modelFallbackChain = [
		'meta-llama/llama-3.2-3b-instruct:free',
		'meta-llama/llama-3.1-8b-instruct:free',
		'google/gemini-flash-1.5:free',
		'mistralai/mistral-7b-instruct:free',
		'microsoft/phi-3-medium-128k-instruct:free',
		'qwen/qwen-2-7b-instruct:free',
		'openchat/openchat-7b:free',
		'google/gemma-2-9b-it:free'
	];
	
	// Cache configuration
	private cache = new Map<string, CacheEntry>();
	private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
	private readonly MAX_CACHE_SIZE = 100;

	private constructor() {}

	static getInstance(): AIService {
		if (!AIService.instance) {
			AIService.instance = new AIService();
		}
		return AIService.instance;
	}

	/**
	 * Generate a tweet based on user prompt and preferences
	 * Implements caching, model fallback, and retry logic
	 */
	async generateTweet(options: GenerateTweetOptions): Promise<string> {
		const { prompt, tone = 'casual', length = 'medium', context, userId } = options;
		
		if (!userId) {
			throw new Error('User ID is required for AI generation');
		}

		// Check cache first
		const cacheKey = JSON.stringify({ prompt, tone, length, context });
		const cached = this.getCachedTweet(cacheKey);
		if (cached) {
			log.info('Returning cached tweet', { model: cached.model });
			// Track cached usage
			await this.trackUsage(userId, cached.model, true).catch(err => 
				log.warn('Failed to track cached usage', { error: err.message })
			);
			return cached.tweet;
		}

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

		// Build model priority list (user's default first, then fallback chain)
		const modelsToTry = [
			settings.defaultModel,
			...this.modelFallbackChain.filter(m => m !== settings.defaultModel)
		];

		log.info('Generating tweet with OpenRouter', {
			tone,
			length,
			hasContext: !!context,
			promptLength: prompt.length,
			primaryModel: settings.defaultModel,
			fallbackModels: modelsToTry.length - 1
		});

		// Try each model in sequence with retry logic
		let lastError: Error | null = null;
		
		for (const model of modelsToTry) {
			try {
				const generatedText = await this.callOpenRouterWithRetry(
					settings.apiKey,
					model,
					systemPrompt,
					userPrompt
				);
				const cleanedTweet = this.cleanAndValidateTweet(generatedText, length);
				
				// Cache the successful result
				this.cacheTweet(cacheKey, cleanedTweet, model);
				
				// Track usage (not cached since we just generated it)
				await this.trackUsage(userId, model, false).catch(err => 
					log.warn('Failed to track usage', { error: err.message })
				);
				
				log.info('Tweet generated successfully', {
					outputLength: cleanedTweet.length,
					model,
					isFailover: model !== settings.defaultModel
				});

				return cleanedTweet;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				const errorMsg = lastError.message;
				
				// Check if we should try the next model
				if (this.shouldFallbackToNextModel(errorMsg)) {
					log.warn(`Model ${model} failed, trying next model`, { error: errorMsg });
					continue;
				}
				
				// If it's not a fallback-able error, throw immediately
				throw lastError;
			}
		}
		
		// All models failed
		log.error('All models failed to generate tweet', {
			modelsAttempted: modelsToTry.length,
			lastError: lastError?.message
		});
		
		throw new Error(
			lastError?.message || 'All AI models failed. Please try again later.'
		);
	}

	/**
	 * Build system prompt based on tone and length
	 * Improved to be more moderation-friendly and brand-safe
	 */
	private buildSystemPrompt(tone: TweetTone, length: TweetLength): string {
		const toneInstructions = {
			casual: 'Write in a friendly, conversational tone that feels natural and approachable.',
			professional: 'Write in a professional, polished tone. Be clear, authoritative, and respectful.',
			funny: 'Write with light humor and wit. Keep it playful and positive.',
			inspirational: 'Write in an uplifting, motivational tone. Be encouraging and positive.',
			informative: 'Write in a clear, educational tone. Be factual and helpful.'
		};

		const lengthInstructions = {
			short: 'Keep it brief and impactful (under 100 characters).',
			medium: 'Use a moderate length for balance (100-180 characters).',
			long: 'Use more space to elaborate (up to 280 characters).'
		};

		return `You are a professional social media content creator for Twitter/X. ${toneInstructions[tone]} ${lengthInstructions[length]}

Important Guidelines:
- Write ONLY the tweet text, nothing else
- Create content that is positive, constructive, and brand-safe
- Follow platform community guidelines and be appropriate for all audiences
- Do NOT include hashtags unless specifically requested
- Do NOT include quotes around the tweet
- Do NOT include "Tweet:" or similar prefixes
- Keep under 280 characters
- Make it engaging, authentic, and professional
- Use emojis sparingly and only when they add value
- Avoid controversial topics unless specifically requested
- Focus on helpful, informative, or entertaining content`;
	}

	/**
	 * Call OpenRouter API with retry logic and exponential backoff
	 */
	private async callOpenRouterWithRetry(
		apiKey: string,
		model: string,
		systemPrompt: string,
		userPrompt: string,
		maxRetries: number = 3
	): Promise<string> {
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				return await this.callOpenRouter(apiKey, model, systemPrompt, userPrompt);
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				
				// Don't retry for certain errors
				if (this.shouldNotRetry(errorMsg)) {
					throw error;
				}
				
				// If this is the last attempt, throw the error
				if (attempt === maxRetries - 1) {
					throw error;
				}
				
				// Exponential backoff: 1s, 2s, 4s
				const waitTime = Math.pow(2, attempt) * 1000;
				log.info(`Retrying after ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`, { model });
				await new Promise(resolve => setTimeout(resolve, waitTime));
			}
		}
		
		throw new Error('Max retries exceeded');
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
	async isConfigured(userId?: string): Promise<boolean> {
		if (!userId) {
			return false;
		}
		try {
			const settings = await this.db.getOpenRouterSettings(userId);
			return !!(settings && settings.enabled && settings.apiKey);
		} catch {
			return false;
		}
	}
	
	/**
	 * Get cached tweet if available and not expired
	 */
	private getCachedTweet(cacheKey: string): CacheEntry | null {
		const cached = this.cache.get(cacheKey);
		if (!cached) {
			return null;
		}
		
		const age = Date.now() - cached.timestamp;
		if (age > this.CACHE_TTL) {
			this.cache.delete(cacheKey);
			return null;
		}
		
		return cached;
	}
	
	/**
	 * Cache a generated tweet
	 */
	private cacheTweet(cacheKey: string, tweet: string, model: string): void {
		// Implement simple LRU by deleting oldest entries when cache is full
		if (this.cache.size >= this.MAX_CACHE_SIZE) {
			const firstKey = this.cache.keys().next().value;
			if (firstKey) {
				this.cache.delete(firstKey);
			}
		}
		
		this.cache.set(cacheKey, {
			tweet,
			timestamp: Date.now(),
			model
		});
	}
	
	/**
	 * Determine if we should try the next model in fallback chain
	 */
	private shouldFallbackToNextModel(errorMsg: string): boolean {
		const fallbackErrors = [
			'rate limit',
			'too many requests',
			'429',
			'moderation',
			'content policy',
			'service unavailable',
			'503',
			'timeout',
			'timed out',
			'model not available',
			'model is currently unavailable'
		];
		
		const lowerError = errorMsg.toLowerCase();
		return fallbackErrors.some(err => lowerError.includes(err));
	}
	
	/**
	 * Determine if we should NOT retry a request
	 */
	private shouldNotRetry(errorMsg: string): boolean {
		const noRetryErrors = [
			'invalid api key',
			'unauthorized',
			'401',
			'invalid request',
			'400'
		];
		
		const lowerError = errorMsg.toLowerCase();
		return noRetryErrors.some(err => lowerError.includes(err));
	}
	
	/**
	 * Track API usage for analytics and rate limiting
	 */
	private async trackUsage(userId: string, model: string, cached: boolean = false): Promise<void> {
		try {
			await this.db.trackAIUsage({
				userId,
				model,
				cached,
				success: true
			});
			log.info('AI generation usage tracked', { userId, model, cached });
		} catch (error) {
			log.warn('Failed to track usage', { error });
		}
	}
	
	/**
	 * Get usage statistics for a user
	 */
	async getUsageStats(userId: string, timeframe: 'day' | 'week' | 'month' = 'month') {
		return await this.db.getAIUsageStats(userId, timeframe);
	}
}
