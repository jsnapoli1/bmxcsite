/**
 * The HTML a person sees after clicking a link in a confirmation email.
 *
 * These two routes are the only endpoints in this application a human
 * reaches by navigating directly, and they were built to answer like an
 * API. Two things followed from that, and both were bugs:
 *
 * 1. A browser navigating to /api/subscribe/confirm never reached the
 *    Worker at all. `not_found_handling: "single-page-application"` makes
 *    the static-asset layer serve index.html for a navigation it does not
 *    recognise, and React Router then rendered "Error 404 — Page not
 *    found". curl saw the Worker's JSON and looked fine; a real click did
 *    not. Answering with HTML is what makes the asset layer hand the
 *    request to the Worker.
 * 2. Even when it did answer, a parent got a wall of JSON.
 *
 * The JSON path is kept for programmatic callers — the tests assert on it
 * — and chosen by the Accept header, which a navigating browser always
 * sends as text/html.
 */

/** Whether this request is a browser navigating, rather than an API call. */
export function wantsHtml(request) {
  return (request.headers.get('accept') ?? '').includes('text/html');
}

/**
 * A minimal page in the site's own voice and palette.
 *
 * Deliberately self-contained: it carries its own styles rather than
 * pulling in the site bundle, so it renders instantly and cannot break
 * when an asset hash changes. Plain and direct, per the Voice section of
 * CLAUDE.md — no em-dash aphorisms, no rule-of-three.
 */
export function resultPage({ title, body }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${title} — Blue Mountain XC Camp</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #faf8f4;
        color: #1c1a17;
        font-family: 'Source Serif 4', 'Iowan Old Style', Georgia, serif;
        line-height: 1.5;
        padding: 1.5rem;
      }
      main { max-width: 32rem; }
      h1 { font-size: clamp(1.75rem, 1.4rem + 1.4vw, 2.5rem); margin: 0 0 0.75rem; }
      p { margin: 0 0 1.25rem; color: #4a463f; }
      a {
        display: inline-block;
        border: 1px solid #183060;
        border-radius: 2px;
        background: #183060;
        color: #fff;
        text-decoration: none;
        font-weight: 600;
        font-size: 0.95rem;
        padding: 0.6rem 1.1rem;
      }
      .rule { border: none; border-top: 2px solid #1c1a17; margin: 0 0 1.5rem; }
    </style>
  </head>
  <body>
    <main>
      <hr class="rule" />
      <h1>${title}</h1>
      <p>${body}</p>
      <a href="/">Back to the camp site</a>
    </main>
  </body>
</html>`;
}
