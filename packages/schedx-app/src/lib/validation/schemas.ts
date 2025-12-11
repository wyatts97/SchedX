import { z } from 'zod';
import { browser } from '$app/environment';

// Common validation patterns
const uuidSchema = z.string().uuid();
const emailSchema = z.string().email();
const urlSchema = z.string().url();
const dateSchema = z.coerce.date();
const positiveIntSchema = z.number().int().positive();

// File schema for browser environment
const fileSchema = z.any();

// Tweet validation schemas
export const tweetContentSchema = z
	.string()
	.min(1, 'Tweet content cannot be empty')
	.max(280, 'Tweet content cannot exceed 280 characters')
	.refine((content) => {
		// Check for valid characters (basic Unicode support)
		return /^[\s\S]*$/.test(content);
	}, 'Tweet content contains invalid characters');

export const tweetSchema = z.object({
	content: tweetContentSchema,
	scheduledDate: dateSchema.min(new Date(), 'Scheduled date must be in the future'),
	community: z.string().min(1, 'Community is required').max(100, 'Community name too long'),
	twitterAccountId: uuidSchema,
	media: z
		.array(
			z.object({
				url: urlSchema,
				type: z.enum(['photo', 'gif', 'video'])
			})
		)
		.optional()
		.default([]),
	recurrenceType: z.enum(['daily', 'weekly', 'monthly']).optional(),
	recurrenceInterval: positiveIntSchema.optional(),
	recurrenceEndDate: dateSchema.optional()
});

export const draftSchema = z.object({
	content: tweetContentSchema,
	scheduledDate: dateSchema.optional(),
	community: z.string().min(1, 'Community is required').max(100, 'Community name too long'),
	twitterAccountId: uuidSchema,
	media: z
		.array(
			z.object({
				url: urlSchema,
				type: z.enum(['photo', 'gif', 'video'])
			})
		)
		.optional()
		.default([])
});

// User account validation schemas
export const userAccountSchema = z.object({
	userId: z.string().min(1, 'User ID is required'),
	username: z.string().min(1, 'Username is required').max(50, 'Username too long'),
	displayName: z.string().max(100).optional(),
	profileImage: urlSchema.optional(),
	provider: z.string().min(1, 'Provider is required'),
	providerAccountId: z.string().min(1, 'Provider account ID is required'),
	access_token: z.string().min(1, 'Access token is required'),
	refresh_token: z.string().min(1, 'Refresh token is required'),
	expires_at: z.number().int().positive(),
	expires_in: z.number().int().positive(),
	token_type: z.string().min(1, 'Token type is required'),
	scope: z.string().min(1, 'Scope is required'),
	twitterAppId: uuidSchema,
	isDefault: z.boolean().optional().default(false)
});

// Twitter app validation schemas
export const twitterAppSchema = z.object({
	name: z.string().min(1, 'App name is required').max(100, 'App name too long'),
	clientId: z.string().min(1, 'Client ID is required'),
	clientSecret: z.string().min(1, 'Client secret is required'),
	consumerKey: z.string().min(1, 'Consumer key is required'),
	consumerSecret: z.string().min(1, 'Consumer secret is required'),
	accessToken: z.string().min(1, 'Access token is required'),
	accessTokenSecret: z.string().min(1, 'Access token secret is required'),
	callbackUrl: urlSchema
});

// Admin user validation schemas
export const adminUserSchema = z.object({
	username: z
		.string()
		.min(3, 'Username must be at least 3 characters')
		.max(50, 'Username too long')
		.regex(
			/^[a-zA-Z0-9_-]+$/,
			'Username can only contain letters, numbers, underscores, and hyphens'
		),
	password: z
		.string()
		.min(8, 'Password must be at least 8 characters')
		.max(128, 'Password too long')
		.regex(
			/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
			'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
		),
	displayName: z.string().max(100).optional(),
	email: emailSchema.optional(),
	avatar: urlSchema.optional()
});

// Password requirements:
// - At least 8 characters
// - At least one uppercase letter
// - At least one lowercase letter
// - At least one number
// - At least one special character
const passwordSchema = z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const loginSchema = z.object({
    username: z.string()
        .min(1, 'Username is required')
        .max(50, 'Username must be less than 50 characters')
        .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dots, underscores, and hyphens'),
    // Do NOT enforce complexity at login; only require a non-empty password
    password: z.string().min(1, 'Password is required'),
    // Optional requestId for traceability
    requestId: z.string().uuid().optional()
});

export type LoginData = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, 'Current password is required'),
		newPassword: z
			.string()
			.min(8, 'Password must be at least 8 characters')
			.max(128, 'Password too long')
			.regex(
				/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
				'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
			),
		confirmPassword: z.string().min(1, 'Password confirmation is required')
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords don't match",
		path: ['confirmPassword']
	});

// File upload validation schemas
export const fileUploadSchema = z.object({
	file: fileSchema,
	accountId: uuidSchema.optional()
});

export const mediaUploadSchema = z.object({
	file: fileSchema
		.refine((file) => file.size <= 50 * 1024 * 1024, 'File size must be less than 50MB')
		.refine(
			(file) =>
				[
					'image/jpeg',
					'image/png',
					'image/gif',
					'image/webp',
					'video/mp4',
					'video/webm',
					'video/quicktime',
					'video/mov'
				].includes(file.type),
			'File type must be JPEG, PNG, GIF, WebP, MP4, WebM, or MOV'
		),
	// accountId can be a UUID or a Twitter provider account ID (numeric string)
	accountId: z.string().optional()
});

// API request validation schemas
export const paginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	sortDirection: z.enum(['asc', 'desc']).default('asc')
});

export const tweetQuerySchema = z.object({
	userId: z.string().min(1, 'User ID is required'),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	status: z.enum(['draft', 'scheduled', 'posted', 'failed']).optional(),
	twitterAccountId: uuidSchema.optional(),
	sortDirection: z.enum(['asc', 'desc']).default('asc')
});

// Bulk operations validation
export const bulkOperationSchema = z.object({
	operation: z.enum(['delete', 'duplicate', 'updateStatus']),
	tweetIds: z
		.array(uuidSchema)
		.min(1, 'At least one tweet ID is required')
		.max(100, 'Too many tweets selected'),
	status: z.enum(['draft', 'scheduled', 'posted', 'failed']).optional()
});

// OAuth validation schemas
export const oauthCallbackSchema = z.object({
	code: z.string().min(1, 'Authorization code is required'),
	state: z.string().min(1, 'State parameter is required'),
	twitterAppId: uuidSchema
});

// Notification validation schemas
export const notificationSchema = z.object({
	userId: z.string().min(1, 'User ID is required'),
	type: z.enum([
		'tweet_posted',
		'tweet_failed',
		'tweet_scheduled',
		'tweet_deleted',
		'tweet_rescheduled'
	]),
	message: z.string().min(1, 'Message is required').max(500, 'Message too long'),
	tweetId: uuidSchema.optional(),
	extra: z.record(z.any()).optional()
});

// Environment validation schema
export const environmentSchema = z.object({
	AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
	DB_ENCRYPTION_KEY: z.string().min(32, 'DB_ENCRYPTION_KEY must be at least 32 characters'),
	MONGODB_URI: z.string().url('MONGODB_URI must be a valid URL'),
	HOST: z.string().default('0.0.0.0'),
	ORIGIN: z.string().url('ORIGIN must be a valid URL'),
	PORT: z.coerce.number().int().min(1).max(65535).default(5173),
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	MAX_UPLOAD_SIZE: z.coerce
		.number()
		.int()
		.min(1024)
		.max(100 * 1024 * 1024)
		.default(52428800)
});

// Export validation helper functions
export const validateRequest = <T>(
	schema: z.ZodSchema<T>,
	data: unknown
): { success: true; data: T } | { success: false; errors: string[] } => {
	try {
		const result = schema.parse(data);
		return { success: true, data: result };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				errors: error.errors.map((err) => `${err.path.join('.')}: ${err.message}`)
			};
		}
		return { success: false, errors: ['Validation failed'] };
	}
};

export const validateFormData = async <T>(
	schema: z.ZodSchema<T>,
	formData: FormData
): Promise<{ success: true; data: T } | { success: false; errors: string[] }> => {
	try {
		const data: any = {};
		for (const [key, value] of formData.entries()) {
			data[key] = value;
		}
		return validateRequest(schema, data);
	} catch (error) {
		return { success: false, errors: ['Form data validation failed'] };
	}
};
