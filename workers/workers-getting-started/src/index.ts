import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
	const ai = c.env.AI;

	const content = c.req.query('query') || 'Give me a motivational quote to get better today';

	const messages = [
		{ role: 'system', content: 'You are a friendly assistant' },
		{
			role: 'user',
			content,
		},
	];
	const response = await ai.run('@cf/meta/llama-4-scout-17b-16e-instruct', { messages });

	return c.json(response);
});

export default app;
