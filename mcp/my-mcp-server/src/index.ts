import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

function createServer(env: Env) {
  const server = new McpServer({
    name: "Authless Calculator",
    version: "1.0.0",
  });

  server.registerTool(
    "store_value",
    {
      description: "Store a simple key-value pair in Cloudflare KV",
      inputSchema: z.object({
        key: z.string().describe("Key to store the value under"),
        value: z.string().describe("Value to store"),
      }),
    },
    async ({ key, value }) => {
      try {
        await env.TODO_STORE.put(key, value);

        return {
          content: [{ type: "text", text: "Value stored successfully" }],
        };
      } catch (error) {
        throw new Error(`Failed to store value: ${error}`, { cause: error });
      }
    },
  );

  return server;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return createMcpHandler(() => createServer(env))(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
