import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

function createServer() {
  const server = new McpServer({
    name: "Authless Calculator",
    version: "1.0.0",
  });

  server.registerTool(
    "add",
    { inputSchema: z.object({ a: z.number(), b: z.number() }) },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }],
    }),
  );

  server.registerTool(
    "calculate",
    {
      inputSchema: z.object({
        operation: z.enum(["add", "subtract", "multiply", "divide"]),
        a: z.number(),
        b: z.number(),
      }),
    },
    async ({ operation, a, b }) => {
      let result: number;
      switch (operation) {
        case "add":
          result = a + b;
          break;
        case "subtract":
          result = a - b;
          break;
        case "multiply":
          result = a * b;
          break;
        case "divide":
          if (b === 0)
            return {
              content: [
                {
                  type: "text",
                  text: "Error: Cannot divide by zero",
                },
              ],
            };
          result = a / b;
          break;
      }
      return { content: [{ type: "text", text: String(result) }] };
    },
  );

  server.registerTool(
    "generate_random_number",
    {
      description: "Generates a truly random number between two numbers",
      inputSchema: z.object({ min: z.number(), max: z.number() }),
    },
    async ({ min, max }) => {
      try {
        // Fetch true randomness from the drand beacon endpoint
        const response = await fetch(
          "https://drand.cloudflare.com/public/latest",
        );
        const data = (await response.json()) as {
          round: number;
          signature: string;
          previous_signature: string;
          randomness: string;
        };

        // Process randomness
        const randomHex = data.randomness;
        const startIndex = Math.floor(Math.random() * (randomHex.length - 8));
        const randomValue = parseInt(
          randomHex.slice(startIndex, startIndex + 8),
          16,
        );

        // Scale to requested range
        const scaledRandom = min + (Math.abs(randomValue) % (max - min + 1));

        return {
          content: [
            {
              type: "text",
              text: String(scaledRandom),
            },
          ],
        };
      } catch {
        // Fallback to Math.random() if drand fails
        return {
          content: [
            {
              type: "text",
              text: String(Math.floor(Math.random() * (max - min + 1)) + min),
            },
          ],
        };
      }
    },
  );

  return server;
}

const handler = createMcpHandler(createServer);

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return handler(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
