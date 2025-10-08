import { createServer } from 'http';
import { runHealthChecks, getSimpleHealthCheck } from './health.js';
import { log } from './logger.js';

const PORT = process.env.HEALTH_PORT || 3001;

export function startHealthServer() {
	const server = createServer(async (req, res) => {
		// Set CORS headers
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		res.setHeader('Content-Type', 'application/json');

		// Handle preflight requests
		if (req.method === 'OPTIONS') {
			res.writeHead(200);
			res.end();
			return;
		}

		// Only handle GET requests
		if (req.method !== 'GET') {
			res.writeHead(405);
			res.end(JSON.stringify({ error: 'Method not allowed' }));
			return;
		}

		try {
			const url = new URL(req.url || '/', `http://localhost:${PORT}`);
			const detailed = url.searchParams.get('detailed') === 'true';

			if (detailed) {
				// Run comprehensive health checks
				const healthStatus = await runHealthChecks();
				
				const statusCode = healthStatus.overall === 'healthy' ? 200 : 
								  healthStatus.overall === 'degraded' ? 200 : 503;
				
				res.writeHead(statusCode);
				res.end(JSON.stringify(healthStatus));
			} else {
				// Simple health check for load balancers
				const simpleCheck = await getSimpleHealthCheck();
				
				const statusCode = simpleCheck.status === 'ok' ? 200 : 503;
				
				res.writeHead(statusCode);
				res.end(JSON.stringify(simpleCheck));
			}
		} catch (error) {
			log.error('Health check server error', { error });
			
			res.writeHead(503);
			res.end(JSON.stringify({
				status: 'error',
				message: 'Health check failed',
				timestamp: new Date().toISOString()
			}));
		}
	});

	server.listen(PORT, () => {
		log.info(`Scheduler health check server started on port ${PORT}`);
	});

	// Graceful shutdown
	process.on('SIGTERM', () => {
		log.info('Shutting down health check server...');
		server.close(() => {
			log.info('Health check server closed');
		});
	});

	process.on('SIGINT', () => {
		log.info('Shutting down health check server...');
		server.close(() => {
			log.info('Health check server closed');
		});
	});

	return server;
}
