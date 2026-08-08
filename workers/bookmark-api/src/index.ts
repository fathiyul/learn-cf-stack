interface Bookmark {
	id: string;
	url: string;
	title: string;
	createdAt: string;
}

// In-memory store (lost on restart, we will fix this in Step 3)
const bookmarks: Map<string, Bookmark> = new Map();

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		// GET /bookmarks - list all (optionally filtered by ?search=term)
		if (path === '/bookmarks' && method === 'GET') {
			return listBookmarks(url.searchParams.get('search'));
		}

		// POST /bookmarks - create
		if (path === '/bookmarks' && method === 'POST') {
			return createBookmark(request);
		}

		// Match /bookmarks/:id pattern (used by both GET and DELETE below)
		const match = path.match(/^\/bookmarks\/([a-zA-Z0-9_-]+)$/);

		// GET /bookmarks/:id - get one
		if (match && method === 'GET') {
			return getBookmark(match[1]);
		}

		// PUT /bookmarks/:id - update one
		if (match && method === 'PUT') {
			return updateBookmark(match[1], request);
		}

		// DELETE /bookmarks/:id - delete one
		if (match && method === 'DELETE') {
			return deleteBookmark(match[1]);
		}

		// Fallback
		if (path === '/') {
			return Response.json({
				name: 'Bookmark API',
				endpoints: ['GET /bookmarks', 'POST /bookmarks', 'GET /bookmarks/:id', 'PUT /bookmarks/:id', 'DELETE /bookmarks/:id'],
			});
		}

		return Response.json({ error: 'Not Found' }, { status: 404 });
	},
};

function listBookmarks(search: string | null): Response {
	const all = Array.from(bookmarks.values()).filter((bookmark) => {
		if (!search) {
			return true;
		}
		return bookmark.title.toLowerCase().includes(search.toLowerCase());
	});
	return Response.json({ bookmarks: all, count: all.length });
}

async function createBookmark(request: Request): Promise<Response> {
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

	bookmarks.set(id, bookmark);

	return Response.json(bookmark, { status: 201 });
}

function getBookmark(id: string): Response {
	const bookmark = bookmarks.get(id);
	if (!bookmark) {
		return Response.json({ error: 'Bookmark not found' }, { status: 404 });
	}
	return Response.json(bookmark);
}

async function updateBookmark(id: string, request: Request): Promise<Response> {
	const bookmark = bookmarks.get(id);
	if (!bookmark) {
		return Response.json({ error: 'Bookmark not found' }, { status: 404 });
	}

	let body: { url?: string; title?: string };

	try {
		body = (await request.json()) as { url?: string; title?: string };
	} catch {
		return Response.json({ error: 'Invalid JSON in request body' }, { status: 400 });
	}

	if (body.url === undefined && body.title === undefined) {
		return Response.json({ error: 'No fields to update: provide url and/or title' }, { status: 400 });
	}

	if (body.url !== undefined) {
		bookmark.url = body.url;
	}
	if (body.title !== undefined) {
		bookmark.title = body.title;
	}

	return Response.json(bookmark);
}

function deleteBookmark(id: string): Response {
	if (!bookmarks.has(id)) {
		return Response.json({ error: 'Bookmark not found' }, { status: 404 });
	}
	bookmarks.delete(id);
	return Response.json({ message: 'Bookmark deleted' });
}
