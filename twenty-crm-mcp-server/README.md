# Twenty CRM MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that exposes [Twenty CRM](https://twenty.com/) data to AI assistants.

## Prerequisites

- Node.js 18 or later
- A running Twenty CRM instance
- A Twenty CRM API key (Settings → API & Webhooks → API Keys)

## Installation

```bash
cd twenty-crm-mcp-server
npm install
```

## Configuration

Set the following environment variables before starting the server:

| Variable | Default | Description |
|---|---|---|
| `TWENTY_API_URL` | `http://localhost:3000` | Base URL of your Twenty instance |
| `TWENTY_API_KEY` | *(required)* | Your Twenty CRM API key |

## Usage with Claude Desktop / Claude.ai

Add the following to your MCP server configuration (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "twenty-crm": {
      "command": "node",
      "args": ["/absolute/path/to/twenty-crm-mcp-server/index.js"],
      "env": {
        "TWENTY_API_URL": "https://your-twenty-instance.com",
        "TWENTY_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Replace `/absolute/path/to/twenty-crm-mcp-server/index.js` with the actual path on your machine.

## Available Tools

### People
| Tool | Description |
|---|---|
| `search_people` | Search contacts by name or email |
| `get_person` | Fetch a contact by ID |
| `create_person` | Create a new contact |
| `update_person` | Update an existing contact |

### Companies
| Tool | Description |
|---|---|
| `search_companies` | Search companies by name |
| `get_company` | Fetch a company by ID (includes linked people & opportunities) |
| `create_company` | Create a new company |
| `update_company` | Update an existing company |

### Opportunities
| Tool | Description |
|---|---|
| `search_opportunities` | Search deals by name |
| `get_opportunity` | Fetch an opportunity by ID |
| `create_opportunity` | Create a new deal |
| `update_opportunity` | Update an existing deal |

### Notes
| Tool | Description |
|---|---|
| `create_note` | Create a note |

### Metadata
| Tool | Description |
|---|---|
| `get_metadata` | List all available object types in the Twenty instance |
