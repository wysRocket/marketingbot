import "dotenv/config";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { McpClient } from "./mcpClient";
import { generateFingerprint } from "./fingerprint";
import type { SiteProfile } from "../sites";

export interface AgentTask {
  siteProfile: SiteProfile;
  taskDescription: string;
  proxyUrl?: string;
  agentIndex: number;
}

export interface AgentResult {
  agentIndex: number;
  success: boolean;
  summary: string;
  error?: string;
  durationMs: number;
}

const IMAGE_BLOCK_JS = `
(function() {
  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (/\\.(png|jpe?g|gif|webp|svg|ico|bmp|avif)(\\?|$)/i.test(url)) {
      this.abort();
      return;
    }
    return _open.apply(this, arguments);
  };
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.tagName === 'IMG') node.src = '';
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.querySelectorAll('img').forEach(function(img) { img.src = ''; });
})();
`;

function buildPatchrightArgs(proxyUrl: string | undefined, configPath: string): string[] {
  const args: string[] = ["patchright-mcp@latest", "--config", configPath];
  return args;
}

function writeTempConfig(
  proxyUrl: string | undefined,
  fingerprint: ReturnType<typeof generateFingerprint>,
  configPath: string,
): void {
  const config: Record<string, unknown> = {
    browser: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        `--user-agent=${fingerprint.userAgent}`,
        `--lang=${fingerprint.locale}`,
        ...(proxyUrl
          ? [`--proxy-server=${proxyUrl}`, "--proxy-bypass-list=*.googleapis.com,*.unsplash.com"]
          : []),
      ],
      viewport: fingerprint.viewport,
      locale: fingerprint.locale,
      timezoneId: fingerprint.timezone,
    },
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export async function runPatchrightAgent(task: AgentTask): Promise<AgentResult> {
  const startMs = Date.now();
  const { agentIndex, siteProfile, taskDescription, proxyUrl } = task;
  const fingerprint = generateFingerprint();
  const configPath = path.join(os.tmpdir(), `patchright-agent-${agentIndex}-${Date.now()}.json`);

  writeTempConfig(proxyUrl, fingerprint, configPath);

  const mcp = new McpClient("npx", buildPatchrightArgs(proxyUrl, configPath));

  try {
    await mcp.connect();

    const tools = await mcp.listTools();

    // Block images on every new page via evaluate after navigation
    const hasBrowserEvaluate = tools.some((t) => t.name === "browser_evaluate");

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

    const systemPrompt = `You are a human web user browsing ${siteProfile.baseUrl}.
Your task: ${taskDescription}

Rules:
- Browse naturally: scroll, read, click links, explore the site
- After every page navigation, call browser_evaluate with this exact script to block images and save bandwidth:
${IMAGE_BLOCK_JS}
- Do NOT fill forms with fake data unless the task explicitly asks for login
- Spend at least 30 seconds on the site total
- When done, respond with a brief summary of what you did`;

    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `Please start browsing ${siteProfile.baseUrl} as instructed.`,
      },
    ];

    let iterations = 0;
    const MAX_ITERATIONS = 50;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages,
      });

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn") {
        const textBlock = response.content.find((b) => b.type === "text");
        const summary = textBlock ? (textBlock as Anthropic.TextBlock).text : "Session complete";
        return {
          agentIndex,
          success: true,
          summary,
          durationMs: Date.now() - startMs,
        };
      }

      if (response.stop_reason === "tool_use") {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          let resultContent: string;
          try {
            resultContent = await mcp.callTool(block.name, block.input as Record<string, unknown>);
          } catch (err) {
            resultContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
          }
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: resultContent,
          });
        }

        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // max_tokens or other stop
      break;
    }

    return {
      agentIndex,
      success: true,
      summary: "Session ended (max iterations or tokens)",
      durationMs: Date.now() - startMs,
    };
  } catch (err) {
    return {
      agentIndex,
      success: false,
      summary: "",
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startMs,
    };
  } finally {
    await mcp.close();
    try {
      fs.unlinkSync(configPath);
    } catch {
      // ignore
    }
  }
}
