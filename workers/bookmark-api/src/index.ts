interface Bookmark {
	id: string;
	url: string;
	title: string;
	createdAt: string;
}

// REMOVED: const bookmarks: Map<string, Bookmark> = new Map();
// Bookmarks are now stored in KV via env.BOOKMARKS

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		// CHANGED: all handlers now receive env for KV access
		if (path === '/bookmarks' && method === 'GET') {
			return listBookmarks(env);
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
				version: '2.0.0',
				storage: 'Workers KV',
				endpoints: ['GET /bookmarks', 'POST /bookmarks', 'GET /bookmarks/:id', 'DELETE /bookmarks/:id'],
			});
		}

		return Response.json({ error: 'Not Found' }, { status: 404 });
	},
};

// CHANGED: list from KV using .list() + individual .get() calls
// NOTE: This fetches each value individually (N+1 pattern). Fine for small
// datasets, but for better performance at scale, store titles as KV metadata
// so you can list without fetching each value (see the challenge below).
async function listBookmarks(env: Env): Promise<Response> {
	const keys = await env.BOOKMARKS.list();
	const all: Bookmark[] = [];

	for (const key of keys.keys) {
		const value = await env.BOOKMARKS.get<Bookmark>(key.name, 'json');
		if (value) all.push(value);
	}

	return Response.json({ bookmarks: all, count: all.length });
}

// CHANGED: store in KV with .put()
async function createBookmark(request: Request, env: Env): Promise<Response> {
	let body: { url?: string; title?: string };

	try {
		body = (await request.json()) as { url?: string; title?: string };
	} catch {
		return Response.json({ error: 'Invalid JSON in request body' }, { status: 400 });
	}

	if (!body.url || !body.title) {
		return Response.json({ error: 'Missing required fields: url, title' }, { status: 400 });
	}

	const id = crypto.randomUUID().slice(0, 8);
	const bookmark: Bookmark = {
		id,
		url: body.url,
		title: body.title,
		createdAt: new Date().toISOString(),
	};

	// Store as JSON in KV, keyed by ID
	await env.BOOKMARKS.put(id, JSON.stringify(bookmark));

	return Response.json(bookmark, { status: 201 });
}

// CHANGED: retrieve from KV with .get()
async function getBookmark(id: string, env: Env): Promise<Response> {
	const bookmark = await env.BOOKMARKS.get<Bookmark>(id, 'json');
	if (!bookmark) {
		return Response.json({ error: 'Bookmark not found' }, { status: 404 });
	}
	return Response.json(bookmark);
}

// CHANGED: delete from KV with .delete()
async function deleteBookmark(id: string, env: Env): Promise<Response> {
	const existing = await env.BOOKMARKS.get(id);
	if (!existing) {
		return Response.json({ error: 'Bookmark not found' }, { status: 404 });
	}
	await env.BOOKMARKS.delete(id);
	return Response.json({ message: 'Bookmark deleted' });
}
