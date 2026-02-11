import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;

async function start() {
  const fastify = Fastify({
    logger: true,
  });

  // Serve static files from Qwik build
  await fastify.register(fastifyStatic, {
    root: join(__dirname, '../dist'),
    prefix: '/',
  });

  // Custom SSR handler for metadata (Discord/social previews)
  fastify.get('/*', async (request, reply) => {
    const userAgent = request.headers['user-agent'] || '';
    
    // Check if request is from a bot/crawler
    const isCrawler = /bot|crawler|spider|discord|twitter|facebook|linkedin/i.test(userAgent);
    
    if (isCrawler) {
      // Serve metadata-optimized HTML for crawlers
      // TODO: Implement route-specific metadata injection
      reply.type('text/html');
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>BA Hub - Broken Arrow Stats</title>
  <meta name="description" content="Lightweight stats viewer for Broken Arrow">
  <meta property="og:title" content="BA Hub - Broken Arrow Stats">
  <meta property="og:description" content="Browse units, build decks, explore maps">
  <meta property="og:type" content="website">
</head>
<body>
  <h1>BA Hub</h1>
  <p>Loading...</p>
</body>
</html>`;
    }
    
    // For regular users, serve the SPA
    reply.sendFile('index.html');
  });

  await fastify.listen({ port: PORT as number, host: '0.0.0.0' });
  
  console.log(`🎮 Frontend server running on http://localhost:${PORT}`);
}

start().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
