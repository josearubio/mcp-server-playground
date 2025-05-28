import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { URLAnalyzer } from './infrastructure/adapter/out/web-scraper-service.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHttpApiAdapter } from './infrastructure/adapter/in/http-rest-adapter.js';

interface AnalyzeUrlArgs {
  url: string;
  options?: Record<string, unknown>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = 3000;

/**
 * Main MCP URL Analyzer server.
 */
class MCPURLAnalyzer {
  private server: Server;
  private analyzer: URLAnalyzer;
  private webApp: ReturnType<typeof createHttpApiAdapter>;

  constructor() {
    this.server = new Server({
      name: 'url-analyzer',
      version: '1.0.0',
    });

    this.analyzer = new URLAnalyzer();
    this.webApp = createHttpApiAdapter(this.analyzer);
    this.setupHandlers();
  }

  /**
   * Sets up MCP handlers for tools.
   */
  private setupHandlers() {
    const analyzeUrlTool: Tool = {
      name: 'analyze_url',
      description: 'Analyze a URL and extract comprehensive information',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to analyze',
          },
          options: {
            type: 'object',
            properties: {
              includeContent: {
                type: 'boolean',
                description: 'Include page content analysis',
                default: true,
              },
              includeSEO: {
                type: 'boolean',
                description: 'Include SEO analysis',
                default: true,
              },
              includePerformance: {
                type: 'boolean',
                description: 'Include performance metrics',
                default: true,
              },
            },
          },
        },
        required: ['url'],
      },
    };

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [analyzeUrlTool],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'analyze_url') {
        try {
          if (!this.isAnalyzeUrlArgs(args)) {
            throw new Error('Invalid arguments: expected { url: string, options?: object }');
          }
          const result = await this.analyzer.analyzeURL(
            args.url,
            typeof args.options === 'object' && args.options !== null ? args.options : {}
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          } as CallToolResult;
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error analyzing URL: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          } as CallToolResult;
        }
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  /**
   * Starts the web and MCP server.
   */
  async run() {
    const port = Number(process.env.PORT) || DEFAULT_PORT;
    this.webApp.listen(port, () => {
      console.log(`Web dashboard available at http://localhost:${port}`);
    });

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('MCP URL Analyzer server running');
  }

  /**
   * Validates arguments for URL analysis.
   */
  private isAnalyzeUrlArgs(args: unknown): args is AnalyzeUrlArgs {
    return (
      typeof args === 'object' &&
      args !== null &&
      'url' in args &&
      typeof (args as { url: unknown }).url === 'string'
    );
  }
}

// Start the server
const analyzer = new MCPURLAnalyzer();
analyzer.run().catch(console.error);