interface Bucket {
	count: number;
	resetAt: number;
}

/** Small fixed-window limiter. Single process, so in-memory state is enough. */
export function createRateLimiter(max: number, windowMs: number) {
	const buckets = new Map<string, Bucket>();
	return {
		/** Returns seconds until retry when limited, otherwise 0. */
		hit(key: string): number {
			const now = Date.now();
			const b = buckets.get(key);
			if (!b || b.resetAt <= now) {
				buckets.set(key, { count: 1, resetAt: now + windowMs });
				return 0;
			}
			b.count++;
			if (b.count > max) return Math.ceil((b.resetAt - now) / 1000);
			return 0;
		},
		reset(key: string) {
			buckets.delete(key);
		}
	};
}

export const loginLimiter = createRateLimiter(10, 15 * 60 * 1000);
