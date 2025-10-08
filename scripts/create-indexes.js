#!/usr/bin/env node

/**
 * Database Index Creation Script
 * Creates optimized indexes for better query performance
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
	console.error('❌ MONGODB_URI not set in environment');
	process.exit(1);
}

const indexes = {
	tweets: [
		// Query: Find tweets by user and status
		{ key: { userId: 1, status: 1 }, name: 'idx_user_status' },
		
		// Query: Find tweets by account and status
		{ key: { twitterAccountId: 1, status: 1 }, name: 'idx_account_status' },
		
		// Query: Find due tweets for scheduling
		{ key: { status: 1, scheduledDate: 1 }, name: 'idx_status_scheduled' },
		
		// Query: Recent tweets (sorted by creation date)
		{ key: { userId: 1, createdAt: -1 }, name: 'idx_user_created' },
		
		// Query: Find tweets by account and date range
		{ key: { twitterAccountId: 1, createdAt: -1 }, name: 'idx_account_created' },
		
		// Compound index for scheduled tweets
		{ key: { userId: 1, status: 1, scheduledDate: 1 }, name: 'idx_user_status_scheduled' },
		
		// Index for Twitter tweet ID lookups
		{ key: { twitterTweetId: 1 }, name: 'idx_twitter_tweet_id', sparse: true }
	],
	
	user_accounts: [
		// Query: Find accounts by user
		{ key: { userId: 1 }, name: 'idx_user' },
		
		// Query: Find account by provider account ID (unique)
		{ key: { providerAccountId: 1 }, name: 'idx_provider_account', unique: true },
		
		// Query: Find accounts by user and provider
		{ key: { userId: 1, provider: 1 }, name: 'idx_user_provider' },
		
		// Query: Active accounts
		{ key: { userId: 1, isActive: 1 }, name: 'idx_user_active' }
	],
	
	twitter_apps: [
		// Query: Find app by client ID (unique)
		{ key: { clientId: 1 }, name: 'idx_client_id', unique: true },
		
		// Query: Active apps
		{ key: { isActive: 1 }, name: 'idx_active' }
	],
	
	admin_users: [
		// Query: Find admin by username (unique)
		{ key: { username: 1 }, name: 'idx_username', unique: true },
		
		// Query: Find admin by session
		{ key: { sessionId: 1 }, name: 'idx_session', sparse: true }
	],
	
	notifications: [
		// Query: Find notifications by user
		{ key: { userId: 1, createdAt: -1 }, name: 'idx_user_created' },
		
		// Query: Unread notifications
		{ key: { userId: 1, read: 1 }, name: 'idx_user_read' },
		
		// TTL index: Auto-delete old notifications after 30 days
		{ key: { createdAt: 1 }, name: 'idx_ttl', expireAfterSeconds: 2592000 }
	]
};

async function createIndexes() {
	const client = new MongoClient(MONGODB_URI);
	
	try {
		console.log('🔗 Connecting to MongoDB...');
		await client.connect();
		console.log('✅ Connected to MongoDB\n');
		
		const db = client.db('schedx');
		
		for (const [collectionName, collectionIndexes] of Object.entries(indexes)) {
			console.log(`📊 Creating indexes for collection: ${collectionName}`);
			const collection = db.collection(collectionName);
			
			for (const indexSpec of collectionIndexes) {
				try {
					const { key, name, ...options } = indexSpec;
					await collection.createIndex(key, { name, ...options });
					console.log(`  ✅ Created index: ${name}`);
				} catch (error) {
					if (error.code === 85) {
						// Index already exists with different options
						console.log(`  ⚠️  Index ${indexSpec.name} exists with different options, dropping and recreating...`);
						await collection.dropIndex(indexSpec.name);
						const { key, name, ...options } = indexSpec;
						await collection.createIndex(key, { name, ...options });
						console.log(`  ✅ Recreated index: ${name}`);
					} else if (error.code === 86) {
						// Index already exists
						console.log(`  ℹ️  Index ${indexSpec.name} already exists`);
					} else {
						console.error(`  ❌ Failed to create index ${indexSpec.name}:`, error.message);
					}
				}
			}
			console.log('');
		}
		
		console.log('🎉 All indexes created successfully!\n');
		
		// List all indexes for verification
		console.log('📋 Index Summary:');
		for (const collectionName of Object.keys(indexes)) {
			const collection = db.collection(collectionName);
			const existingIndexes = await collection.indexes();
			console.log(`\n${collectionName}:`);
			existingIndexes.forEach(idx => {
				console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
			});
		}
		
	} catch (error) {
		console.error('❌ Error creating indexes:', error);
		process.exit(1);
	} finally {
		await client.close();
		console.log('\n✅ Disconnected from MongoDB');
	}
}

// Run the script
createIndexes();
