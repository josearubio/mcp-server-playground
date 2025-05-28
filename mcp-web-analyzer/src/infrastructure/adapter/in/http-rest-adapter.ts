import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { URLAnalyzer } from '../out/web-scraper-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '../public');

/**
 * Creates and configures an API adapter (for testing purposes only).
 */
export function createHttpApiAdapter(analyzer: URLAnalyzer): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  app.post('/api/analyze', async (req, res) => {
    try {
      const { url, options } = req.body;
      if (typeof url !== 'string' || !url) {
        return res.status(400).json({ error: 'Missing or invalid "url" parameter.' });
      }
      const result = await analyzer.analyzeURL(
        url,
        typeof options === 'object' && options !== null ? options : {}
      );
      res.json(result);
    } catch (error) {
      console.error('Error in /api/analyze:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}
