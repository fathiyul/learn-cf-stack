interface Bookmark {
	id: string;
	url: string;
	title: string;
	tags: string;
	summary: string; // NEW: AI-generated summary
	created_at: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		if (path === '/bookmarks' && method === 'GET') {
			return listBookmarks(env, url);
		}

		if (path === '/bookmarks' && method === 'POST') {
			return createBookmark(request, env);
		}

		const match = path.match(/^\/bookmarks\/([a-zA-Z0-9_-]+)$/);
		if (match && method === 'GET') {
			return getBookmark(match[1], env);
		}

		if (match && method === 'DELETE') {
			return deleteBookmark(match[1], env);
		}

		if (path === '/') {
			return Response.json({
				name: 'Bookmark API',
				version: '4.0.0',
				storage: 'D1 + KV cache',
				ai: 'Workers AI (auto-summary)',
				endpoints: ['GET /bookmarks', 'GET /bookmarks?tag=docs', 'POST /bookmarks', 'GET /bookmarks/:id', 'DELETE /bookmarks/:id'],
			});
		}

		return Response.json({ error: 'Not Found' }, { status: 404 });
	},
};

// NEW: generate a summary using Workers AI
async function generateSummary(title: string, url: string, env: Env): Promise<string> {
	try {
		const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
			messages: [
				{
					role: 'system',
					content:
						'You are a helpful assistant that writes concise bookmark descriptions. Respond with exactly one sentence, no more than 20 words.',
				},
				{
					role: 'user',
					content: `Write a one-sentence description for this bookmark:\nTitle: ${title}\nURL: ${url}`,
				},
			],
		});

		// env.AI.run() returns an object like { response: "the text" }.
		// So response.response accesses the generated text. This is not a typo!
		return response.response?.trim() || '';
	} catch (error) {
		console.error('AI summary failed:', error);
		return ''; // Fail gracefully - bookmark is saved without summary
	}
}

// CHANGED: calls generateSummary before saving
async function createBookmark(request: Request, env: Env): Promise<Response> {
	let body: { url?: string; title?: string; tags?: string };

	try {
		body = (await request.json()) as { url?: string; title?: string; tags?: string };
	} catch {
		return Response.json({ error: 'Invalid JSON in request body' }, { status: 400 });
	}

	if (!body.url || !body.title) {
		return Response.json({ error: 'Missing required fields: url, title' }, { status: 400 });
	}

	const id = crypto.randomUUID().slice(0, 8);
	const tags = body.tags || '';

	// NEW: generate AI summary
	const summary = await generateSummary(body.title, body.url, env);

	// Write to D1 (now includes summary)
	const result = await env.DB.prepare(
		`INSERT INTO bookmarks (id, url, title, tags, summary)
     VALUES (?, ?, ?, ?, ?)
     RETURNING *`,
	)
		.bind(id, body.url, body.title, tags, summary)
		.first<Bookmark>();

	if (!result) {
		return Response.json({ error: 'Failed to create bookmark' }, { status: 500 });
	}

	// Cache in KV
	await env.BOOKMARKS.put(id, JSON.stringify(result), { expirationTtl: 3600 });

	return Response.json(result, { status: 201 });
}

// UNCHANGED from Step 4
async function listBookmarks(env: Env, url: URL): Promise<Response> {
	const tag = url.searchParams.get('tag');

	let results: Bookmark[];

	if (tag) {
		const { results: rows } = await env.DB.prepare(`SELECT * FROM bookmarks WHERE tags LIKE ? ORDER BY created_at DESC`)
			.bind(`%${tag}%`)
			.all<Bookmark>();
		results = rows;
	} else {
		const { results: rows } = await env.DB.prepare(`SELECT * FROM bookmarks ORDER BY created_at DESC`).all<Bookmark>();
		results = rows;
	}

	return Response.json({ bookmarks: results, count: results.length });
}

// UNCHANGED from Step 4
async function getBookmark(id: string, env: Env): Promise<Response> {
	const cached = await env.BOOKMARKS.get<Bookmark>(id, 'json');
	if (cached) {
		return Response.json({ ...cached, _cached: true });
	}

	const bookmark = await env.DB.prepare('SELECT * FROM bookmarks WHERE id = ?').bind(id).first<Bookmark>();

	if (!bookmark) {
		return Response.json({ error: 'Bookmark not found' }, { status: 404 });
	}

	await env.BOOKMARKS.put(id, JSON.stringify(bookmark), { expirationTtl: 3600 });
	return Response.json(bookmark);
}

// UNCHANGED from Step 4
async function deleteBookmark(id: string, env: Env): Promise<Response> {
	const existing = await env.DB.prepare('SELECT id FROM bookmarks WHERE id = ?').bind(id).first();

	if (!existing) {
		return Response.json({ error: 'Bookmark not found' }, { status: 404 });
	}

	await env.DB.prepare('DELETE FROM bookmarks WHERE id = ?').bind(id).run();
	await env.BOOKMARKS.delete(id);

	return Response.json({ message: 'Bookmark deleted' });
}
