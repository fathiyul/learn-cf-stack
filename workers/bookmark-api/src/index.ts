interface Bookmark {
	id: string;
	url: string;
	title: string;
	tags: string; // NEW: comma-separated tags
	created_at: string; // NEW: from D1 DATETIME
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
				version: '3.0.0',
				storage: 'D1 + KV cache',
				endpoints: ['GET /bookmarks', 'GET /bookmarks?tag=docs', 'POST /bookmarks', 'GET /bookmarks/:id', 'DELETE /bookmarks/:id'],
			});
		}

		return Response.json({ error: 'Not Found' }, { status: 404 });
	},
};

// CHANGED: query D1, support filtering by tag
async function listBookmarks(env: Env, url: URL): Promise<Response> {
	const tag = url.searchParams.get('tag');

	let results: Bookmark[];

	if (tag) {
		// Filter by tag using LIKE (tags is comma-separated)
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

// CHANGED: write to D1, then cache in KV
// NOTE on SQL safety: every user-provided value is passed through .bind(),
// which uses parameterized queries. This prevents SQL injection, even when
// using LIKE with wildcards like %${tag}%. Never concatenate user input
// directly into SQL strings.
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

	// Write to D1 (source of truth)
	const result = await env.DB.prepare(
		`INSERT INTO bookmarks (id, url, title, tags)
     VALUES (?, ?, ?, ?)
     RETURNING *`,
	)
		.bind(id, body.url, body.title, tags)
		.first<Bookmark>();

	if (!result) {
		return Response.json({ error: 'Failed to create bookmark' }, { status: 500 });
	}

	// Cache in KV for fast reads
	await env.BOOKMARKS.put(id, JSON.stringify(result), { expirationTtl: 3600 });

	return Response.json(result, { status: 201 });
}

// CHANGED: check KV cache first, fall back to D1
async function getBookmark(id: string, env: Env): Promise<Response> {
	// Try KV cache first
	const cached = await env.BOOKMARKS.get<Bookmark>(id, 'json');
	if (cached) {
		return Response.json({ ...cached, _cached: true });
	}

	// Fall back to D1
	const bookmark = await env.DB.prepare('SELECT * FROM bookmarks WHERE id = ?').bind(id).first<Bookmark>();

	if (!bookmark) {
		return Response.json({ error: 'Bookmark not found' }, { status: 404 });
	}

	// Populate cache for next time
	await env.BOOKMARKS.put(id, JSON.stringify(bookmark), { expirationTtl: 3600 });

	return Response.json(bookmark);
}

// CHANGED: delete from D1 and invalidate KV cache
async function deleteBookmark(id: string, env: Env): Promise<Response> {
	const existing = await env.DB.prepare('SELECT id FROM bookmarks WHERE id = ?').bind(id).first();

	if (!existing) {
		return Response.json({ error: 'Bookmark not found' }, { status: 404 });
	}

	// Delete from D1
	await env.DB.prepare('DELETE FROM bookmarks WHERE id = ?').bind(id).run();

	// Invalidate KV cache
	await env.BOOKMARKS.delete(id);

	return Response.json({ message: 'Bookmark deleted' });
}
