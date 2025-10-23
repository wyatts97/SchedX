import { log } from '$lib/server/logger';
import { getEnvironmentConfig } from '$lib/server/env';
import { InferenceSession, Tensor } from 'onnxruntime-node';
import { join } from 'path';
import { existsSync } from 'fs';

export type TweetTone = 'casual' | 'professional' | 'funny' | 'inspirational' | 'informative';
export type TweetLength = 'short' | 'medium' | 'long';

interface GenerateTweetOptions {
	prompt: string;
	tone?: TweetTone;
	length?: TweetLength;
	context?: string;
	userId?: string;
}

/**
 * AI Service for generating tweet content using local ONNX model
 */
export class AIService {
	private static instance: AIService;
	private session: InferenceSession | null = null;
	private modelPath: string;
	private config = getEnvironmentConfig();

	private constructor() {
		// Model path - handle both Docker and local environments
		// In Docker: /app/packages/schedx-app/static/models/distilgpt2.onnx
		// Locally: process.cwd()/packages/schedx-app/static/models/distilgpt2.onnx
		const isDocker = process.env.DOCKER === 'true';
		this.modelPath = isDocker 
			? '/app/packages/schedx-app/static/models/distilgpt2.onnx'
			: join(process.cwd(), 'packages', 'schedx-app', 'static', 'models', 'distilgpt2.onnx');
	}

	static getInstance(): AIService {
		if (!AIService.instance) {
			AIService.instance = new AIService();
		}
		return AIService.instance;
	}

	/**
	 * Initialize the ONNX model
	 */
	private async initializeModel(): Promise<void> {
		if (this.session) return;

		if (this.config.USE_LOCAL_AI !== 'true') {
			throw new Error('Local AI is not enabled. Set USE_LOCAL_AI=true in your environment.');
		}

		if (!existsSync(this.modelPath)) {
			throw new Error(`AI model not found at ${this.modelPath}. Run 'npm run download-model' first.`);
		}

		try {
			log.info('Loading ONNX model', { path: this.modelPath });
			this.session = await InferenceSession.create(this.modelPath);
			log.info('ONNX model loaded successfully');
		} catch (error) {
			log.error('Failed to load ONNX model', { error });
			throw new Error('Failed to initialize AI model');
		}
	}

	/**
	 * Generate a tweet based on user prompt and preferences
	 */
	async generateTweet(options: GenerateTweetOptions): Promise<string> {
		const { prompt, tone = 'casual', length = 'medium', context } = options;

		await this.initializeModel();

		const systemPrompt = this.buildSystemPrompt(tone, length);
		const fullPrompt = context 
			? `${systemPrompt}\n\nContext: ${context}\n\nPrompt: ${prompt}\n\nTweet:`
			: `${systemPrompt}\n\nPrompt: ${prompt}\n\nTweet:`;

		log.info('Generating tweet with local AI', {
			tone,
			length,
			hasContext: !!context,
			promptLength: prompt.length
		});

		try {
			const generatedText = await this.runInference(fullPrompt);
			const cleanedTweet = this.cleanAndValidateTweet(generatedText, length);
			
			log.info('Tweet generated successfully with local AI', {
				outputLength: cleanedTweet.length
			});

			return cleanedTweet;
		} catch (error) {
			log.error('Failed to generate tweet with local AI', {
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
	 * Run inference with the ONNX model
	 */
	private async runInference(prompt: string): Promise<string> {
		if (!this.session) {
			throw new Error('Model not initialized');
		}

		try {
			// Get configuration parameters
			const temperature = parseFloat(this.config.LOCAL_AI_TEMPERATURE || '0.8');
			const maxTokens = parseInt(this.config.LOCAL_AI_MAX_TOKENS || '120', 10);

			// Create input tensor
			const inputTensor = new Tensor('string', [prompt], [1]);
			
			// Run inference
			const feeds = { input: inputTensor };
			const results = await this.session.run(feeds);
			
			// Extract output
			const output = results.output;
			if (!output || !output.data || output.data.length === 0) {
				throw new Error('No output from model');
			}

			// Convert output to string
			const generatedText = String(output.data[0]).trim();
			
			if (!generatedText) {
				throw new Error('Model generated empty output');
			}

			return generatedText;
		} catch (error) {
			log.error('Inference failed', { error });
			throw new Error('Failed to generate text with AI model');
		}
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
	 * Check if local AI is configured and available
	 */
	async isConfigured(): Promise<boolean> {
		try {
			if (this.config.USE_LOCAL_AI !== 'true') {
				return false;
			}
			return existsSync(this.modelPath);
		} catch {
			return false;
		}
	}
}
