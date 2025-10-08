# SchedX Scheduler Service

This service runs periodically to check for and post scheduled tweets to X (formerly Twitter). It's built with TypeScript and uses a cron-based scheduler with automatic token refresh capabilities.

## Features

- **Automatic Scheduling**: Uses cron jobs to periodically check for due tweets
- **Batch Processing**: Groups tweets by user for efficient processing
- **Token Management**: Validates and automatically refreshes Twitter API tokens when needed
- **Error Handling**: Comprehensive error handling with detailed logging
- **Database Integration**: Uses the same MongoDB database as schedx-app to manage tweet status and user accounts
- **Development Tools**: Supports single-run mode for testing and debugging

## Architecture

The service is organized into modular components:

- `index.ts` - Main entry point with cron scheduling and graceful shutdown
- `config.ts` - Environment configuration management
- `logger.ts` - Structured logging with Pino (development-friendly output)
- `tokenManager.ts` - Twitter API token management with auto-refresh
- `tweetProcessor.ts` - Core tweet processing and posting logic

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with your configuration:
   ```env
   # Database Configuration
   MONGODB_URI=mongodb://localhost:27017
   DB_ENCRYPTION_KEY=your_encryption_key_here
   
   # Cron Schedule (default: every minute)
   CRON_SCHEDULE=* * * * *
   
   # Twitter/X API credentials for OAuth 2.0
   AUTH_TWITTER_ID=your_twitter_client_id
   AUTH_TWITTER_SECRET=your_twitter_client_secret
   TWITTER_API_KEY=your_twitter_api_key
   TWITTER_API_SECRET=your_twitter_api_secret
   
   # Environment (optional, defaults to development)
   NODE_ENV=production
   ```

3. Build the TypeScript code:
   ```bash
   npm run build
   ```

## Running the Service

### Production Mode
```bash
npm start
```

### Development Mode
```bash
npm run dev
```

### Single Run (Testing)
```bash
npm run dev:once
```

### Debug Mode
```bash
npm run dev:debug
```

## Configuration

### Environment Variables

- `MONGODB_URI`: MongoDB connection string
- `DB_ENCRYPTION_KEY`: Encryption key for sensitive data
- `CRON_SCHEDULE`: Cron expression for scheduling (default: `* * * * *`)
- `NODE_ENV`: Environment mode (`development` or `production`)

### Twitter API Configuration

The service uses the same Twitter API credentials as the main SchedX app. Ensure your Twitter app credentials are properly configured in the main application.

## Logging

The service uses Pino for structured logging:

- **Development**: Pretty-printed logs with timestamps
- **Production**: JSON-formatted logs for log aggregation

## Error Handling

The service includes comprehensive error handling:

- **Token refresh failures**: Automatic retry with exponential backoff
- **API rate limits**: Respects Twitter API rate limits
- **Database connection issues**: Graceful handling of MongoDB connection problems
- **Network timeouts**: Configurable timeouts for API calls

## Monitoring

The service logs important events:

- **Tweet processing**: Success/failure of tweet posting
- **Token refresh**: Automatic token refresh events
- **Scheduler events**: Start/stop of scheduling cycles
- **Error events**: Detailed error logging with context

## Development

### Running Tests
```bash
npm test
```

### Debugging
```bash
npm run dev:debug
```

This will start the service in debug mode with Node.js inspector enabled.

## Deployment

The service is designed to run in Docker containers alongside the main SchedX application. See the main README for deployment instructions. 