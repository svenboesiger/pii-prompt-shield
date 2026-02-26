#!/usr/bin/env node
/**
 * Twenty CRM MCP Server
 *
 * Provides tools for interacting with the Twenty CRM API via the
 * Model Context Protocol (MCP).
 *
 * Configuration (via environment variables):
 *   TWENTY_API_URL   - Base URL of your Twenty instance (default: http://localhost:3000)
 *   TWENTY_API_KEY   - API key for authentication (required)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_URL = process.env.TWENTY_API_URL || "http://localhost:3000";
const API_KEY = process.env.TWENTY_API_KEY || "";

// ---------------------------------------------------------------------------
// GraphQL helper
// ---------------------------------------------------------------------------

async function gql(query, variables = {}) {
  if (!API_KEY) {
    throw new Error(
      "TWENTY_API_KEY environment variable is not set. " +
        "Please configure it with your Twenty CRM API key."
    );
  }

  const response = await fetch(`${API_URL}/api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Twenty API HTTP error ${response.status}: ${text}`
    );
  }

  const json = await response.json();

  if (json.errors && json.errors.length > 0) {
    throw new Error(
      `Twenty API GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`
    );
  }

  return json.data;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  // ---- People ----
  {
    name: "search_people",
    description:
      "Search for people (contacts) in Twenty CRM. Returns a list of matching people with their details.",
    inputSchema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          description:
            'Optional search filter string (e.g. a name or email fragment). Leave empty to list recent people.',
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default 20, max 100).",
        },
      },
    },
  },
  {
    name: "get_person",
    description: "Get a specific person (contact) by their ID from Twenty CRM.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The unique ID of the person.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "create_person",
    description: "Create a new person (contact) in Twenty CRM.",
    inputSchema: {
      type: "object",
      properties: {
        firstName: { type: "string", description: "First name." },
        lastName: { type: "string", description: "Last name." },
        email: { type: "string", description: "Primary email address." },
        phone: { type: "string", description: "Primary phone number." },
        jobTitle: { type: "string", description: "Job title." },
        companyId: {
          type: "string",
          description: "ID of the company to associate this person with.",
        },
      },
    },
  },
  {
    name: "update_person",
    description: "Update an existing person (contact) in Twenty CRM.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The unique ID of the person to update." },
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        jobTitle: { type: "string" },
        companyId: { type: "string" },
      },
      required: ["id"],
    },
  },

  // ---- Companies ----
  {
    name: "search_companies",
    description:
      "Search for companies in Twenty CRM. Returns a list of matching companies with their details.",
    inputSchema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          description: "Optional search filter string (e.g. a company name fragment).",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default 20, max 100).",
        },
      },
    },
  },
  {
    name: "get_company",
    description: "Get a specific company by its ID from Twenty CRM.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The unique ID of the company." },
      },
      required: ["id"],
    },
  },
  {
    name: "create_company",
    description: "Create a new company in Twenty CRM.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Company name." },
        domainName: { type: "string", description: "Company website domain (e.g. acme.com)." },
        employees: { type: "number", description: "Number of employees." },
        linkedinUrl: { type: "string", description: "LinkedIn profile URL." },
      },
      required: ["name"],
    },
  },
  {
    name: "update_company",
    description: "Update an existing company in Twenty CRM.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The unique ID of the company to update." },
        name: { type: "string" },
        domainName: { type: "string" },
        employees: { type: "number" },
        linkedinUrl: { type: "string" },
      },
      required: ["id"],
    },
  },

  // ---- Opportunities ----
  {
    name: "search_opportunities",
    description:
      "Search for opportunities (deals) in Twenty CRM.",
    inputSchema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          description: "Optional search filter string (e.g. opportunity name fragment).",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default 20, max 100).",
        },
      },
    },
  },
  {
    name: "get_opportunity",
    description: "Get a specific opportunity by its ID from Twenty CRM.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The unique ID of the opportunity." },
      },
      required: ["id"],
    },
  },
  {
    name: "create_opportunity",
    description: "Create a new opportunity (deal) in Twenty CRM.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Opportunity name." },
        amount: {
          type: "number",
          description: "Deal amount (currency value).",
        },
        currency: {
          type: "string",
          description: "Currency code (e.g. USD, EUR). Defaults to USD.",
        },
        stage: {
          type: "string",
          description:
            "Pipeline stage (e.g. NEW, SCREENING, MEETING, PROPOSAL, CUSTOMER). Defaults to NEW.",
        },
        closeDate: {
          type: "string",
          description: "Expected close date in ISO 8601 format (e.g. 2024-12-31).",
        },
        companyId: {
          type: "string",
          description: "ID of the associated company.",
        },
        pointOfContactId: {
          type: "string",
          description: "ID of the point-of-contact person.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "update_opportunity",
    description: "Update an existing opportunity in Twenty CRM.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The unique ID of the opportunity to update." },
        name: { type: "string" },
        amount: { type: "number" },
        currency: { type: "string" },
        stage: { type: "string" },
        closeDate: { type: "string" },
        companyId: { type: "string" },
        pointOfContactId: { type: "string" },
      },
      required: ["id"],
    },
  },

  // ---- Notes ----
  {
    name: "create_note",
    description: "Create a note in Twenty CRM and optionally attach it to a person or company.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Note title." },
        body: { type: "string", description: "Note body / content." },
      },
      required: ["body"],
    },
  },

  // ---- Meta ----
  {
    name: "get_metadata",
    description:
      "Retrieve the list of available object types (metadata) from the Twenty CRM instance. Useful for understanding what data objects exist.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function searchPeople({ filter, limit = 20 }) {
  const take = Math.min(Number(limit) || 20, 100);
  const filterClause = filter
    ? `filter: { or: [{ name: { firstName: { like: "%${filter}%" } } }, { name: { lastName: { like: "%${filter}%" } } }, { emails: { primaryEmail: { like: "%${filter}%" } } }] }`
    : "";
  const data = await gql(`
    query SearchPeople {
      people(${filterClause} orderBy: { createdAt: DescNullsLast }, first: ${take}) {
        edges {
          node {
            id
            name { firstName lastName }
            emails { primaryEmail }
            phones { primaryPhoneNumber }
            jobTitle
            createdAt
            company { id name }
          }
        }
      }
    }
  `);
  return data.people.edges.map((e) => e.node);
}

async function getPerson({ id }) {
  const data = await gql(
    `
    query GetPerson($id: ID!) {
      person(id: $id) {
        id
        name { firstName lastName }
        emails { primaryEmail }
        phones { primaryPhoneNumber }
        jobTitle
        createdAt
        updatedAt
        company { id name }
        opportunities {
          edges { node { id name stage } }
        }
      }
    }
  `,
    { id }
  );
  return data.person;
}

async function createPerson({ firstName, lastName, email, phone, jobTitle, companyId }) {
  const input = {
    name: { firstName: firstName || "", lastName: lastName || "" },
    ...(email && { emails: { primaryEmail: email } }),
    ...(phone && { phones: { primaryPhoneNumber: phone } }),
    ...(jobTitle && { jobTitle }),
    ...(companyId && { company: { id: companyId } }),
  };
  const data = await gql(
    `
    mutation CreatePerson($input: PersonCreateInput!) {
      createPerson(data: $input) {
        id
        name { firstName lastName }
        emails { primaryEmail }
        jobTitle
        createdAt
      }
    }
  `,
    { input }
  );
  return data.createPerson;
}

async function updatePerson({ id, firstName, lastName, email, phone, jobTitle, companyId }) {
  const input = {
    ...(firstName !== undefined || lastName !== undefined
      ? {
          name: {
            ...(firstName !== undefined && { firstName }),
            ...(lastName !== undefined && { lastName }),
          },
        }
      : {}),
    ...(email !== undefined && { emails: { primaryEmail: email } }),
    ...(phone !== undefined && { phones: { primaryPhoneNumber: phone } }),
    ...(jobTitle !== undefined && { jobTitle }),
    ...(companyId !== undefined && { company: { id: companyId } }),
  };
  const data = await gql(
    `
    mutation UpdatePerson($id: ID!, $input: PersonUpdateInput!) {
      updatePerson(id: $id, data: $input) {
        id
        name { firstName lastName }
        emails { primaryEmail }
        jobTitle
        updatedAt
      }
    }
  `,
    { id, input }
  );
  return data.updatePerson;
}

async function searchCompanies({ filter, limit = 20 }) {
  const take = Math.min(Number(limit) || 20, 100);
  const filterClause = filter
    ? `filter: { name: { like: "%${filter}%" } }`
    : "";
  const data = await gql(`
    query SearchCompanies {
      companies(${filterClause} orderBy: { createdAt: DescNullsLast }, first: ${take}) {
        edges {
          node {
            id
            name
            domainName { primaryLinkUrl }
            employees
            createdAt
          }
        }
      }
    }
  `);
  return data.companies.edges.map((e) => e.node);
}

async function getCompany({ id }) {
  const data = await gql(
    `
    query GetCompany($id: ID!) {
      company(id: $id) {
        id
        name
        domainName { primaryLinkUrl }
        employees
        linkedinLink { primaryLinkUrl }
        createdAt
        updatedAt
        people {
          edges { node { id name { firstName lastName } jobTitle } }
        }
        opportunities {
          edges { node { id name stage } }
        }
      }
    }
  `,
    { id }
  );
  return data.company;
}

async function createCompany({ name, domainName, employees, linkedinUrl }) {
  const input = {
    name,
    ...(domainName && { domainName: { primaryLinkUrl: domainName } }),
    ...(employees !== undefined && { employees: Number(employees) }),
    ...(linkedinUrl && { linkedinLink: { primaryLinkUrl: linkedinUrl } }),
  };
  const data = await gql(
    `
    mutation CreateCompany($input: CompanyCreateInput!) {
      createCompany(data: $input) {
        id
        name
        domainName { primaryLinkUrl }
        createdAt
      }
    }
  `,
    { input }
  );
  return data.createCompany;
}

async function updateCompany({ id, name, domainName, employees, linkedinUrl }) {
  const input = {
    ...(name !== undefined && { name }),
    ...(domainName !== undefined && { domainName: { primaryLinkUrl: domainName } }),
    ...(employees !== undefined && { employees: Number(employees) }),
    ...(linkedinUrl !== undefined && { linkedinLink: { primaryLinkUrl: linkedinUrl } }),
  };
  const data = await gql(
    `
    mutation UpdateCompany($id: ID!, $input: CompanyUpdateInput!) {
      updateCompany(id: $id, data: $input) {
        id
        name
        updatedAt
      }
    }
  `,
    { id, input }
  );
  return data.updateCompany;
}

async function searchOpportunities({ filter, limit = 20 }) {
  const take = Math.min(Number(limit) || 20, 100);
  const filterClause = filter
    ? `filter: { name: { like: "%${filter}%" } }`
    : "";
  const data = await gql(`
    query SearchOpportunities {
      opportunities(${filterClause} orderBy: { createdAt: DescNullsLast }, first: ${take}) {
        edges {
          node {
            id
            name
            stage
            amount { amountMicros currencyCode }
            closeDate
            createdAt
            company { id name }
          }
        }
      }
    }
  `);
  return data.opportunities.edges.map((e) => e.node);
}

async function getOpportunity({ id }) {
  const data = await gql(
    `
    query GetOpportunity($id: ID!) {
      opportunity(id: $id) {
        id
        name
        stage
        amount { amountMicros currencyCode }
        closeDate
        createdAt
        updatedAt
        company { id name }
        pointOfContact { id name { firstName lastName } }
      }
    }
  `,
    { id }
  );
  return data.opportunity;
}

function toAmountMicros(amount, currency = "USD") {
  return {
    amountMicros: Math.round(Number(amount) * 1_000_000),
    currencyCode: currency.toUpperCase(),
  };
}

async function createOpportunity({
  name,
  amount,
  currency = "USD",
  stage = "NEW",
  closeDate,
  companyId,
  pointOfContactId,
}) {
  const input = {
    name,
    stage,
    ...(amount !== undefined && { amount: toAmountMicros(amount, currency) }),
    ...(closeDate && { closeDate }),
    ...(companyId && { company: { id: companyId } }),
    ...(pointOfContactId && { pointOfContact: { id: pointOfContactId } }),
  };
  const data = await gql(
    `
    mutation CreateOpportunity($input: OpportunityCreateInput!) {
      createOpportunity(data: $input) {
        id
        name
        stage
        amount { amountMicros currencyCode }
        createdAt
      }
    }
  `,
    { input }
  );
  return data.createOpportunity;
}

async function updateOpportunity({
  id,
  name,
  amount,
  currency,
  stage,
  closeDate,
  companyId,
  pointOfContactId,
}) {
  const input = {
    ...(name !== undefined && { name }),
    ...(stage !== undefined && { stage }),
    ...(amount !== undefined && {
      amount: toAmountMicros(amount, currency || "USD"),
    }),
    ...(closeDate !== undefined && { closeDate }),
    ...(companyId !== undefined && { company: { id: companyId } }),
    ...(pointOfContactId !== undefined && { pointOfContact: { id: pointOfContactId } }),
  };
  const data = await gql(
    `
    mutation UpdateOpportunity($id: ID!, $input: OpportunityUpdateInput!) {
      updateOpportunity(id: $id, data: $input) {
        id
        name
        stage
        updatedAt
      }
    }
  `,
    { id, input }
  );
  return data.updateOpportunity;
}

async function createNote({ title, body }) {
  const input = {
    ...(title && { title }),
    body,
  };
  const data = await gql(
    `
    mutation CreateNote($input: NoteCreateInput!) {
      createNote(data: $input) {
        id
        title
        body
        createdAt
      }
    }
  `,
    { input }
  );
  return data.createNote;
}

async function getMetadata() {
  const data = await gql(`
    query GetMetadata {
      objects {
        edges {
          node {
            id
            nameSingular
            namePlural
            labelSingular
            labelPlural
            description
            isCustom
            isActive
          }
        }
      }
    }
  `);
  return data.objects.edges.map((e) => e.node);
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

async function callTool(name, args) {
  switch (name) {
    case "search_people":        return searchPeople(args);
    case "get_person":           return getPerson(args);
    case "create_person":        return createPerson(args);
    case "update_person":        return updatePerson(args);
    case "search_companies":     return searchCompanies(args);
    case "get_company":          return getCompany(args);
    case "create_company":       return createCompany(args);
    case "update_company":       return updateCompany(args);
    case "search_opportunities": return searchOpportunities(args);
    case "get_opportunity":      return getOpportunity(args);
    case "create_opportunity":   return createOpportunity(args);
    case "update_opportunity":   return updateOpportunity(args);
    case "create_note":          return createNote(args);
    case "get_metadata":         return getMetadata();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// MCP Server bootstrap
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "twenty-crm", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    const result = await callTool(name, args);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${err.message}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
