import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type Anthropic from "@anthropic-ai/sdk";

export interface McpTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export class McpClient {
  private client: Client;
  private transport: StdioClientTransport;

  constructor(command: string, args: string[], env?: Record<string, string>) {
    this.transport = new StdioClientTransport({
      command,
      args,
      env: env ? { ...process.env, ...env } as Record<string, string> : undefined,
    });
    this.client = new Client({ name: "patchright-agent", version: "1.0.0" });
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
  }

  async listTools(): Promise<Anthropic.Tool[]> {
    const result = await this.client.listTools();
    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? "",
      input_schema: (tool.inputSchema as Anthropic.Tool["input_schema"]) ?? { type: "object", properties: {} },
    }));
  }

  async callTool(name: string, input: Record<string, unknown>): Promise<string> {
    const result = await this.client.callTool({ name, arguments: input });
    const content = result.content;
    if (Array.isArray(content)) {
      return content
        .map((c) => {
          if (c.type === "text") return c.text;
          if (c.type === "image") return "[image]";
          return JSON.stringify(c);
        })
        .join("\n");
    }
    return JSON.stringify(content);
  }

  async close(): Promise<void> {
    try {
      await this.client.close();
    } catch {
      // ignore errors on close
    }
  }
}
