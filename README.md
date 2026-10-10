<p align="center">
  <img src="apps/web/public/mangy.png" alt="Mangy mascot" width="320">
</p>

<h1 align="center">Mangy</h1>

Mangy is a self-hosted manga downloader and tracker written in TypeScript. It browses a source, queues chapters, and writes finished downloads into the folders Komga already watches, so the library updates without a manual step.

- Browse popular, latest, and trending series, then search with source filters.
- Queue chapters, cancel them, retry failures, or move a job to the front.
- Download in a background worker, so the queue keeps moving with the browser closed.
- Track series and auto-download new chapters as they release.
- Write completed chapters to configured destinations and trigger a Komga scan for that library.
- Get in-app and browser push notifications for download and tracking events.
- Sign in with email and password, with live UI updates over SSE.

Mangy ships one source adapter, WeebCentral, behind a typed adapter contract. The web app is React with TanStack Router, the API is Elysia with Treaty clients, and the queue, tracking state, and library live in Postgres through Drizzle.
