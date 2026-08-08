import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import worker from "../src/index";

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const DEFAULT_PROMPT = "Give me a motivational quote to get better today";

/**
 * A deterministic stand-in for the Workers AI binding.
 *
 * LLM output is non-deterministic, so unit tests replace `env.AI` with a
 * fake that always resolves to the given response. That way we can assert on
 * the exact output and on the arguments passed to `ai.run()`.
 */
function mockAi(response: unknown) {
	return {
		run: vi.fn().mockResolvedValue(response),
	} as unknown as Ai;
}

describe("AI worker", () => {
	it("returns the AI response for the provided query (unit style, mocked binding)", async () => {
		const ai = mockAi({ response: "You can do it!" });
		const request = new IncomingRequest("http://example.com/?query=hi");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, { ...env, AI: ai }, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ response: "You can do it!" });
		expect(ai.run).toHaveBeenCalledWith(MODEL, {
			messages: [
				{ role: "system", content: "You are a friendly assistant" },
				{ role: "user", content: "hi" },
			],
		});
	});

	it("falls back to a default prompt when no query is provided (unit style, mocked binding)", async () => {
		const ai = mockAi({ response: "You can do it!" });
		const request = new IncomingRequest("http://example.com/");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, { ...env, AI: ai }, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(ai.run).toHaveBeenCalledWith(MODEL, {
			messages: [
				{ role: "system", content: "You are a friendly assistant" },
				{ role: "user", content: DEFAULT_PROMPT },
			],
		});
	});

	it("returns a chat completion through the real binding (integration style)", async () => {
		// Note: this test calls the real Workers AI API (requires being logged
		// in), so it is slower and the exact response text varies. Only the
		// response shape is asserted.
		const response = await SELF.fetch("https://example.com/?query=test");
		expect(response.status).toBe(200);

		const body = (await response.json()) as {
			object?: string;
			response?: string;
			choices?: { message?: { content?: string } }[];
		};

		expect(body.object).toBe("chat.completion");
		expect(body.response).toEqual(expect.any(String));
		expect(body.response!.length).toBeGreaterThan(0);
		expect(body.choices?.[0]?.message?.content).toEqual(expect.any(String));
	});
});
