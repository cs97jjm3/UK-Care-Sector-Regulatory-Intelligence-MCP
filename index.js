#!/usr/bin/env node

// Add uncaught exception handlers first
process.on('uncaughtException', (error) => {
  console.error('FATAL: Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('FATAL: Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

// Server setup
const server = new Server(
  {
    name: 'uk-care-regulatory-intelligence',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// API helper for Gov.uk
async function fetchGovUK(endpoint, params = {}) {
  const url = new URL(endpoint);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Gov.uk API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// API helper for Parliament
async function fetchParliament(endpoint, params = {}) {
  const baseUrl = 'https://questions-statements-api.parliament.uk';
  const url = new URL(`${baseUrl}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Parliament API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Format date helper
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
}

// Tool: Search Publications
async function searchPublications(query, days = 30, contentType = 'all') {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  
  // Build params more carefully to avoid 422 errors
  const params = {
    q: query,
    count: 50,
    order: '-public_timestamp'
  };

  // Only add date filter if reasonable
  if (days && days <= 365) {
    params.filter_public_timestamp = `from:${fromDate.toISOString().split('T')[0]}`;
  }

  if (contentType && contentType !== 'all') {
    params.filter_content_store_document_type = contentType;
  }

  try {
    const data = await fetchGovUK('https://www.gov.uk/api/search.json', params);

    const results = (data.results || []).map(item => ({
      title: item.title,
      description: item.description || 'No description available',
      link: `https://www.gov.uk${item.link}`,
      published: formatDate(item.public_timestamp),
      organisations: item.organisations ? item.organisations.map(org => org.title).join(', ') : 'Unknown',
      documentType: item.content_store_document_type || 'Unknown'
    }));

    return {
      totalResults: data.total || 0,
      resultsShown: results.length,
      searchPeriod: `Last ${days} days`,
      query: query,
      results: results
    };
  } catch (error) {
    return {
      totalResults: 0,
      resultsShown: 0,
      searchPeriod: `Last ${days} days`,
      query: query,
      results: [],
      error: error.message
    };
  }
}

// Tool: Parliamentary Questions
async function getParliamentaryQuestions(searchTerm = 'care', days = 90) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  
  const params = {
    take: 50,
    answeringBodyId: 17 // Department of Health and Social Care
  };

  const data = await fetchParliament('/api/writtenquestions/questions', params);

  // Filter by search term in question or answer
  const filtered = data.results.filter(q => {
    const questionText = q.value.questionText?.toLowerCase() || '';
    const answerText = q.value.answerText?.toLowerCase() || '';
    const searchLower = searchTerm.toLowerCase();
    
    return questionText.includes(searchLower) || answerText.includes(searchLower);
  });

  const results = filtered.slice(0, 25).map(item => {
    const q = item.value;
    return {
      questionId: q.id,
      asked: formatDate(q.dateTabled),
      answered: q.dateAnswered ? formatDate(q.dateAnswered) : 'Not yet answered',
      askedBy: q.askingMemberPrinted || 'Unknown',
      question: q.questionText,
      answer: q.answerText || 'Awaiting answer',
      minister: q.answeringMemberPrinted || 'Not assigned'
    };
  });

  return {
    totalFound: filtered.length,
    resultsShown: results.length,
    searchPeriod: `Last ${days} days`,
    searchTerm: searchTerm,
    results: results
  };
}

// Tool: Regulatory Calendar
async function getRegulatoryCalendar(months = 6) {
  // Search for consultations
  const consultResults = await searchPublications('consultation', 90, 'all');
  
  // Search for regulations
  const regResults = await searchPublications('regulation', 90, 'all');
  
  // Combine results
  const allResults = [...consultResults.results, ...regResults.results];
  
  // Filter for future-focused content and deduplicate
  const upcoming = allResults.filter((item, index, self) => {
    // Deduplicate by link
    if (index !== self.findIndex(i => i.link === item.link)) return false;
    
    // Filter for future-focused keywords
    const title = item.title.toLowerCase();
    const desc = item.description.toLowerCase();
    return title.includes('consultation') || 
           title.includes('deadline') || 
           title.includes('coming into force') ||
           desc.includes('deadline') ||
           desc.includes('consultation closes');
  });

  return {
    note: 'This shows recent publications about upcoming changes and consultations. Specific deadline dates require manual review of each publication.',
    searchPeriod: 'Last 90 days',
    upcomingItems: upcoming.slice(0, 15)
  };
}

// Tool: Monthly Digest
async function generateMonthlyDigest() {
  const digest = {
    generatedDate: formatDate(new Date()),
    period: 'Last 30 days',
    sections: {}
  };

  // Get CQC publications
  const cqcResults = await searchPublications('care quality commission', 30, 'all');
  
  // Get care sector publications
  const careResults = await searchPublications('adult social care', 30, 'all');
  
  // Combine and deduplicate
  const allPubs = [...cqcResults.results, ...careResults.results];
  const uniquePubs = allPubs.filter((pub, index, self) => 
    index === self.findIndex(p => p.link === pub.link)
  );
  
  digest.sections.publications = {
    total: uniquePubs.length,
    items: uniquePubs.slice(0, 10)
  };

  // Get parliamentary activity
  const parlResults = await getParliamentaryQuestions('care', 30);
  digest.sections.parliamentary = {
    total: parlResults.totalFound,
    items: parlResults.results.slice(0, 10)
  };

  // Get consultations and deadlines
  const calendarResults = await getRegulatoryCalendar(3);
  digest.sections.upcomingChanges = {
    total: calendarResults.upcomingItems.length,
    items: calendarResults.upcomingItems.slice(0, 10)
  };

  return digest;
}

// Tool definitions
const TOOLS = [
  {
    name: 'search_publications',
    description: 'Search Gov.uk for regulatory publications, guidance, and policy documents from DHSC and CQC. Returns publications from the specified time period.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search terms (e.g., "CQC guidance", "care quality", "adult social care")'
        },
        days: {
          type: 'number',
          description: 'Number of days to search back (default: 30)',
          default: 30
        },
        contentType: {
          type: 'string',
          description: 'Filter by content type (default: "all")',
          enum: ['all', 'guidance', 'regulation', 'consultation', 'policy_paper'],
          default: 'all'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_parliamentary_questions',
    description: 'Get written parliamentary questions and answers about the care sector from DHSC. Useful for tracking policy positions and ministerial responses.',
    inputSchema: {
      type: 'object',
      properties: {
        searchTerm: {
          type: 'string',
          description: 'Search term to filter questions (default: "care")',
          default: 'care'
        },
        days: {
          type: 'number',
          description: 'Number of days to search back (default: 90)',
          default: 90
        }
      },
      required: []
    }
  },
  {
    name: 'get_regulatory_calendar',
    description: 'Find upcoming regulatory changes, consultations, and compliance deadlines. Shows recent publications about future changes.',
    inputSchema: {
      type: 'object',
      properties: {
        months: {
          type: 'number',
          description: 'Months ahead to look for upcoming changes (default: 6)',
          default: 6
        }
      },
      required: []
    }
  },
  {
    name: 'generate_monthly_digest',
    description: 'Generate a comprehensive monthly intelligence digest covering publications, parliamentary activity, and upcoming changes. Perfect for regular review meetings.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'search_publications':
        result = await searchPublications(
          args.query,
          args.days || 30,
          args.contentType || 'all'
        );
        break;

      case 'get_parliamentary_questions':
        result = await getParliamentaryQuestions(
          args.searchTerm || 'care',
          args.days || 90
        );
        break;

      case 'get_regulatory_calendar':
        result = await getRegulatoryCalendar(args.months || 6);
        break;

      case 'generate_monthly_digest':
        result = await generateMonthlyDigest();
        break;

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };

  } catch (error) {
    console.error('Tool execution error:', error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            tool: name,
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Start server - THE KEY FIX: Don't await, just connect
async function main() {
  try {
    const transport = new StdioServerTransport();
    console.error('UK Care Regulatory Intelligence MCP server starting...');
    await server.connect(transport);
    console.error('UK Care Regulatory Intelligence MCP server connected');
    // Server stays connected via the transport
  } catch (error) {
    console.error('Failed to start server:', error);
    throw error;
  }
}

main().catch((error) => {
  console.error('Server fatal error:', error);
  process.exit(1);
});
