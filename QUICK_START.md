# Quick Start Guide

## Building the MCPB Bundle

1. Open terminal and navigate to the directory:
```bash
cd "C:\Users\james\Documents\UK Care Sector Regulatory Intelligence MCP"
```

2. Install dependencies:
```bash
npm install
```

3. Install MCPB CLI (if not already installed):
```bash
npm install -g @anthropic-ai/mcpb
```

4. Validate the manifest:
```bash
mcpb validate .
```

5. Pack the bundle:
```bash
mcpb pack .
```

This creates `uk-care-regulatory-intelligence.mcpb` in the current directory.

## Installing in Claude Desktop

1. Double-click the `.mcpb` file
2. Claude Desktop will show an installation dialog
3. Click "Install"
4. Done

## Testing It Works

In Claude Desktop, try:
- "Search for recent CQC guidance"
- "What parliamentary questions about care homes were asked this month?"
- "Generate a monthly regulatory intelligence digest"

## Distributing to Colleagues

Just send them the `.mcpb` file. They double-click it to install. No manual config needed.

## Updating

When you make changes:
1. Update the version in `package.json` and `manifest.json`
2. Run `mcpb pack .` again
3. Distribute the new `.mcpb` file

Users will see an update notification in Claude Desktop.
