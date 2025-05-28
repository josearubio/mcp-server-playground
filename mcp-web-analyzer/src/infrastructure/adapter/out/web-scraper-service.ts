import fetch, { Headers } from 'node-fetch';
import * as cheerio from 'cheerio';
import URLParse from 'url-parse';

export interface AnalysisOptions {
  includeContent?: boolean;
  includeSEO?: boolean;
  includePerformance?: boolean;
}

export interface URLAnalysis {
  url: string;
  timestamp: string;
  status: {
    code: number;
    message: string;
  };
  basic: {
    domain: string;
    protocol: string;
    path: string;
    query: Record<string, string>;
  };
  content?: {
    title: string;
    description: string;
    headings: {
      h1: string[];
      h2: string[];
      h3: string[];
    };
    links: {
      internal: number;
      external: number;
      total: number;
    };
    images: {
      total: number;
      withAlt: number;
      withoutAlt: number;
    };
    wordCount: number;
  };
  seo?: {
    title: {
      present: boolean;
      length: number;
      optimal: boolean;
    };
    metaDescription: {
      present: boolean;
      length: number;
      optimal: boolean;
    };
    headingStructure: {
      hasH1: boolean;
      h1Count: number;
      properHierarchy: boolean;
    };
    openGraph: Record<string, string>;
    twitterCard: Record<string, string>;
  };
  performance?: {
    responseTime: number;
    contentSize: number;
    resourceCounts: {
      scripts: number;
      stylesheets: number;
      images: number;
    };
  };
  security: {
    https: boolean;
    hasSecurityHeaders: boolean;
  };
}

const TITLE_MIN_LENGTH = 30;
const TITLE_MAX_LENGTH = 60;
const META_DESC_MIN_LENGTH = 120;
const META_DESC_MAX_LENGTH = 160;

export class URLAnalyzer {
  /**
   * Analyzes a URL and returns a structured report.
   * @param url URL to analyze
   * @param options Analysis options
   */
  async analyzeURL(url: string, options: AnalysisOptions = {}): Promise<URLAnalysis> {
    const startTime = Date.now();
    const parsedURL = new URLParse(url, true);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // Fetch the page
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MCP-URL-Analyzer/1.0)',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const html = await response.text();
      const $ = cheerio.load(html);
      const endTime = Date.now();

      const analysis: URLAnalysis = {
        url,
        timestamp: new Date().toISOString(),
        status: {
          code: response.status,
          message: response.statusText,
        },
        basic: {
          domain: parsedURL.hostname,
          protocol: parsedURL.protocol.replace(':', ''),
          path: parsedURL.pathname,
          query: Object.fromEntries(
            Object.entries(parsedURL.query).map(([key, value]) => [key, value ?? ''])
          ),
        },
        security: {
          https: parsedURL.protocol === 'https:',
          hasSecurityHeaders: this.checkSecurityHeaders(response.headers),
        },
      };

      if (options.includeContent !== false) {
        analysis.content = this.analyzeContent($, url);
      }

      if (options.includeSEO !== false) {
        analysis.seo = this.analyzeSEO($);
      }

      if (options.includePerformance !== false) {
        analysis.performance = this.analyzePerformance($, html, endTime - startTime);
      }

      return analysis;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - URL took too long to respond');
      }
      throw error;
    }
  }

  private analyzeContent($: cheerio.CheerioAPI, baseURL: string) {
    const title = $('title').text().trim();
    const description = this.getMetaTag($, 'description');

    const headings = {
      h1: $('h1').map((_, el) => $(el).text().trim()).get(),
      h2: $('h2').map((_, el) => $(el).text().trim()).get(),
      h3: $('h3').map((_, el) => $(el).text().trim()).get(),
    };

    const allLinks = $('a[href]');
    const parsedBase = new URLParse(baseURL);
    let internalLinks = 0;
    let externalLinks = 0;

    allLinks.each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        const parsedLink = new URLParse(href, baseURL);
        if (parsedLink.hostname === parsedBase.hostname) {
          internalLinks++;
        } else {
          externalLinks++;
        }
      }
    });

    const allImages = $('img');
    const imagesWithAlt = $('img[alt]').length;

    // Better wordCount handling (avoids counting empty words)
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = bodyText ? bodyText.split(' ').filter(Boolean).length : 0;

    return {
      title,
      description,
      headings,
      links: {
        internal: internalLinks,
        external: externalLinks,
        total: allLinks.length,
      },
      images: {
        total: allImages.length,
        withAlt: imagesWithAlt,
        withoutAlt: allImages.length - imagesWithAlt,
      },
      wordCount,
    };
  }

  private analyzeSEO($: cheerio.CheerioAPI) {
    const title = $('title').text().trim();
    const metaDescription = this.getMetaTag($, 'description');

    const h1Elements = $('h1');
    const h1Count = h1Elements.length;

    // Check heading hierarchy
    const headings = $('h1, h2, h3, h4, h5, h6').map((_, el) => {
      return parseInt(el.tagName.charAt(1));
    }).get();

    let properHierarchy = true;
    for (let i = 1; i < headings.length; i++) {
      if (headings[i] > headings[i - 1] + 1) {
        properHierarchy = false;
        break;
      }
    }

    // Extract Open Graph tags
    const openGraph: Record<string, string> = {};
    $('meta[property^="og:"]').each((_, el) => {
      const property = $(el).attr('property');
      const content = $(el).attr('content');
      if (property && content) {
        openGraph[property] = content;
      }
    });

    // Extract Twitter Card tags
    const twitterCard: Record<string, string> = {};
    $('meta[name^="twitter:"]').each((_, el) => {
      const name = $(el).attr('name');
      const content = $(el).attr('content');
      if (name && content) {
        twitterCard[name] = content;
      }
    });

    return {
      title: {
        present: title.length > 0,
        length: title.length,
        optimal: title.length >= TITLE_MIN_LENGTH && title.length <= TITLE_MAX_LENGTH,
      },
      metaDescription: {
        present: metaDescription.length > 0,
        length: metaDescription.length,
        optimal: metaDescription.length >= META_DESC_MIN_LENGTH && metaDescription.length <= META_DESC_MAX_LENGTH,
      },
      headingStructure: {
        hasH1: h1Count > 0,
        h1Count,
        properHierarchy,
      },
      openGraph,
      twitterCard,
    };
  }

  private analyzePerformance($: cheerio.CheerioAPI, html: string, responseTime: number) {
    const scripts = $('script').length;
    const stylesheets = $('link[rel="stylesheet"]').length;
    const images = $('img').length;

    return {
      responseTime,
      contentSize: Buffer.byteLength(html, 'utf8'),
      resourceCounts: {
        scripts,
        stylesheets,
        images,
      },
    };
  }

  /**
   * Checks if relevant security headers exist.
   */
  private checkSecurityHeaders(headers: Headers): boolean {
    const securityHeaders = [
      'strict-transport-security',
      'content-security-policy',
      'x-frame-options',
      'x-content-type-options',
    ];

    return securityHeaders.some(header =>
      Array.from(headers.keys()).some(key =>
        key.toLowerCase() === header
      )
    );
  }

  /**
   * Gets the content of a meta tag by name.
   */
  private getMetaTag($: cheerio.CheerioAPI, name: string): string {
    return $(`meta[name="${name}"]`).attr('content') || '';
  }
}