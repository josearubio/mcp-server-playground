# MCP Servers Playground (Web Analyzer) 🛝

This is a sample MCP (Model Context Protocol) server built with Node.js and TypeScript.  
It allows users to interact with websites through natural language queries using an MCP-compatible client (e.g., Claude).

The server supports detailed analysis of websites, including:

- **Performance metrics**
- **SEO insights**
- **Content summaries and descriptions**

This tool demonstrates how natural language interfaces can be integrated with web analysis services using the MCP protocol. In a way, **what we are doing is providing context to LLMs, enabling them to query or perform operations that would not be possible by default in any chatbot or AI agent.**

## Features

- Integration with the Model Context Protocol (MCP).
- Analyze URLs for content, SEO, performance, and security (using Cheerio API). Content of web-scraped-service is AI generated, for testing purposes. 
- HTTP API via Express (for API feature testing purposes only, not required for MCP configuration).

## Tools

- **analyze_url**: Analyze URLs for content, SEO, performance, and security

## Getting Started

### Prerequisites

- Node.js >= 18
- npm
- Claude Desktop (or other MCP client)

### Installation and run

```bash
npm install
```

```bash
npm run build
```

```bash
npm start
```

## Usage

Add this configuration to your Claude Desktop configuration file:

(Usually at ~/.claude/claude_desktop_config.json on macOS/Linux or %APPDATA%\Claude\claude_desktop_config.json on Windows)

```json
{
  "mcpServers": {
    "mcp-example": {
      "command": "node",
      "args": ["/path/to/your/project/dist/index.js"]
    }
  }
}
```
Start Claude Desktop and request to analyze a URL; it will ask for permission to use the tool.

To test via API:

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```
