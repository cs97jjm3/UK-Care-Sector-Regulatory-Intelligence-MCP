# UK Care Sector Regulatory Intelligence MCP

Track regulatory changes and compliance requirements across UK care sector regulators.

## What This Does

Monitors and reports on:
- **Gov.uk Publications** - DHSC and CQC guidance, policy papers, consultations
- **Parliamentary Activity** - Written questions and answers about care sector
- **Regulatory Calendar** - Upcoming changes and compliance deadlines
- **Monthly Digests** - Comprehensive intelligence summaries

## Why This Exists

Regulatory changes affect product roadmaps. This tool automates the tracking so you don't have to manually check gov.uk and parliament.uk every day.

**This is not:**
- A replacement for human judgment
- Legal advice
- A compliance decision-making tool

## Installation

### Option 1: Install as MCPB Bundle (Recommended)

1. Install the MCPB CLI tool:
```bash
npm install -g @anthropic-ai/mcpb
```

2. Navigate to the MCP directory and pack it:
```bash
cd "C:\Users\james\Documents\UK Care Sector Regulatory Intelligence MCP"
mcpb pack .
```

3. Double-click the generated `.mcpb` file to install in Claude Desktop

### Option 2: Manual Installation

1. Install dependencies:
```bash
cd "C:\Users\james\Documents\UK Care Sector Regulatory Intelligence MCP"
npm install
```

2. Add to Claude Desktop config manually (in `%APPDATA%\Claude\claude_desktop_config.json` on Windows):
```json
{
  "mcpServers": {
    "uk-care-regulatory-intelligence": {
      "command": "node",
      "args": [
        "C:\\Users\\james\\Documents\\UK Care Sector Regulatory Intelligence MCP\\index.js"
      ]
    }
  }
}
```

## Tools Available

### 1. search_publications
Find recent regulatory publications from Gov.uk.

**Parameters:**
- `query` - Search terms (e.g., "CQC guidance", "care quality")
- `days` - How many days back to search (default: 30)
- `contentType` - Filter by type: all, guidance, regulation, consultation, policy_paper (default: all)

**Example:**
```
search_publications("CQC guidance", 60, "guidance")
```

### 2. get_parliamentary_questions
Track what MPs are asking DHSC ministers about care sector issues.

**Parameters:**
- `searchTerm` - Filter questions by keyword (default: "care")
- `days` - How many days back to search (default: 90)

**Example:**
```
get_parliamentary_questions("care homes", 60)
```

### 3. get_regulatory_calendar
Find upcoming consultations, deadlines, and regulatory changes.

**Parameters:**
- `months` - Months ahead to look (default: 6)

**Example:**
```
get_regulatory_calendar(3)
```

### 4. generate_monthly_digest
Get a comprehensive intelligence report covering all sources.

**Parameters:** None

**Example:**
```
generate_monthly_digest()
```

## Data Sources

All data comes from free UK government APIs:
- Gov.uk Content API - https://www.gov.uk/api/search.json
- UK Parliament API - https://questions-statements-api.parliament.uk

No API keys required. No rate limits to worry about.

## Usage Tips

**For regular intelligence:**
Run `generate_monthly_digest()` at the start of each month.

**For specific topics:**
Use `search_publications()` with targeted search terms.

**For policy context:**
Check `get_parliamentary_questions()` to see what government is saying.

**For planning:**
Review `get_regulatory_calendar()` quarterly to spot upcoming changes.

## Technical Notes

- Single-file Node.js MCP server
- Uses native fetch (Node 18+)
- No authentication required
- Results returned as formatted JSON
- Parliamentary API only covers DHSC (Department ID 17)

## Limitations

- Can't predict future regulatory changes
- Relies on government publishing data promptly
- Parliamentary questions are DHSC only (not CQC directly)
- Deadline dates require manual review of publications
- No CQC inspection data integration (yet)

## Building for Distribution

To create a distributable MCPB bundle:

```bash
# Install MCPB CLI if you haven't already
npm install -g @anthropic-ai/mcpb

# Validate your manifest
mcpb validate .

# Pack the bundle
mcpb pack .

# This creates uk-care-regulatory-intelligence.mcpb
```

The `.mcpb` file can be shared with colleagues for one-click installation.

## Version

1.0.0 - Initial release

## Author

James - Business Analyst at The Access Group
