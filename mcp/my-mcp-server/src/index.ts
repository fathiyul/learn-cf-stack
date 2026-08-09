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

  server.registerTool(
    "add_new_todo",
    {
      description: "Add a new item to the todo list",
      inputSchema: z.object({
        task: z.string().describe("Task description"),
      }),
    },
    async ({ task }) => {
      await env.TODO_STORE.put(
        `${task}`,
        JSON.stringify({
          completed: false,
          createdAt: new Date().toISOString(),
        }),
      );

      return {
        content: [{ type: "text", text: `Added task: ${task}` }],
      };
    },
  );

  server.registerTool(
    "list_all_todos",
    {
      description: "List all items in the todo list",
      inputSchema: z.object({}),
    },
    async () => {
      const list = await env.TODO_STORE.list();
      const tasks = [];

      for (const key of list.keys) {
        const value = await env.TODO_STORE.get(key.name);
        if (value) {
          let taskData;
          try {
            taskData = JSON.parse(value);
          } catch {
            continue;
          }
          tasks.push(`${taskData.completed ? "✅" : "📋"} ${key.name}`);
        }
      }

      if (tasks.length === 0) {
        return {
          content: [
            { type: "text", text: "No tasks found. Add some tasks first!" },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Todo List:\n${tasks.join("\n")}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "complete_todo",
    {
      description: "Mark a task as completed",
      inputSchema: z.object({
        task: z.string().describe("Task to mark as completed"),
      }),
    },
    async ({ task }) => {
      const value = await env.TODO_STORE.get(task);
      if (!value) {
        return {
          content: [{ type: "text", text: `Task "${task}" not found.` }],
        };
      }

      let taskData;
      try {
        taskData = JSON.parse(value);
      } catch {
        return {
          content: [
            { type: "text", text: `Failed to parse task data for "${task}".` },
          ],
        };
      }

      taskData.completed = true;

      await env.TODO_STORE.put(task, JSON.stringify(taskData));
      return {
        content: [{ type: "text", text: `Completed task: ${task}` }],
      };
    },
  );

  return server;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return createMcpHandler(() => createServer(env))(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
