export default {
	async fetch(request, env, ctx): Promise<Response> {
		const pathname = new URL(request.url).pathname;

		if (pathname !== '/') {
			return new Response('Not Found', { status: 404 });
		}

		return Response.json({
			name: 'Bookmark API',
			version: '1.0.0',
			status: 'running',
			timestamp: new Date().toISOString(),
			region: request.cf?.colo,
		});
	},
} satisfies ExportedHandler<Env>;
