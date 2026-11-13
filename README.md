Welcome to your new TanStack Start app!

# Getting Started

This project uses [Vite+](https://viteplus.dev/) (`vp`) with bun as its
package manager. To run this application:

```bash
vp install
vp dev
```

# Building For Production

To build this application for production:

```bash
vp run build
```

`vp run build` caches the build: a repeat with unchanged sources replays
`dist/` instead of rebuilding. `vp build` always rebuilds.

`vp test` runs the tests. The site deploys to Cloudflare Workers (static
assets, configured in `wrangler.jsonc`) from CI on every push to `main`.

## Benchmark Data

The charts ship generated data, refreshed by four scripts in this order:

```bash
bun run import-benchmarks    # src/data/benchmarks.json
bun run import-aa-evals      # src/data/aa-evals.json
bun run import-frontiercode  # src/data/frontiercode.json
bun run build-plans          # plans.json and chart-benchmarks.json
```

[Artificial Analysis](https://artificialanalysis.ai) is the source of the
model list, Intelligence Index scores, list prices and release dates, and the
cost, tokens and time per task for the models it has run. `import-benchmarks`
reads all of them from an AA model page's flight payload; no API key is
needed. Slopalytics supplies the catalog and fills any point the website
doesn't cover. A score they disagree on stops the import; a price they disagree
on only warns, since a promo can explain the gap, and AA's list price wins.
When AA says it regraded a benchmark, `--allow-score-drift` turns a gap of up
to 1.5 points into a warning so the refresh can proceed before slopalytics
catches up. AA's time per task is decode time, excluding TTFT and overhead.

The nine Intelligence Index evals (Terminal-Bench 4.0, FrontierCode 2.0 and
seven others) come from the same AA page. `import-aa-evals` fetches a
model page, reconstructs its Next.js flight payload, and extracts each model's
per-eval score, cost, tokens and time into `src/data/aa-evals.json`, resolved
against the catalog (unknown families/efforts are skipped with a log; ambiguous
ones stop the import). A family the catalog has only as `default` takes the
website's row when the site lists it at one effort, and the log names it.

Each script takes cached input for offline runs: `import-benchmarks` accepts
`--bundle <bundle.js>` and `--html <page.html>`, and
`import-aa-evals` accepts `--html <page.html>`. `import-frontiercode` has no flags.

AA's cost, tokens and time per task, from the same model page `import-aa-evals`
reads, win over slopalytics' whenever AA has them; slopalytics supplies the
rest. A model AA lists that the slopalytics catalog lacks takes AA's figures
alone when a plan covers its family (the others are left out and logged), and
when AA has no cost for it the import stops, so the gap is deliberate rather
than silent. `bun run import-benchmarks -- --allow-missing-cost` writes it with
a null cost instead; the cost chart leaves it out until a source costs it. A
catalog model that neither source costed ships a null cost without a warning.

FrontierCode 2.0 comes from Cognition's own `data.json`, not a reseller.
`build-plans` then keeps only the points some plan covers and writes the
chart's copy.

The site imports three files without parsing them: `plans.json` and
`chart-benchmarks.json` (parsed by `build-plans` before it writes them) and
`samples.json` (parsed by `measure`), against the schemas in
`src/domain/model.ts`. `src/data/data.test.ts` checks that each is still
exactly what its schema outputs, so a hand edit fails CI rather than the page.

## Brand Images

`public/og.png` (the 1200x630 social card) and `public/apple-touch-icon.png`
are generated, not hand-made:

```bash
bun run render-brand-images
```

It builds the site first, so the card always matches the current source.

The card is the chart's own "Download PNG" export of the default view, fitted
onto 1200x630. The icon is `public/favicon.svg` drawn full bleed, since iOS
rounds its corners itself. The script needs Chromium for `playwright-core`
(`bunx playwright-core install chromium`).

## Profiling The Home Page

```bash
bun run profile-page --out profile.json
```

It builds the site unminified, so component and function names survive
(React stays in production mode), and serves `dist/client`. In Chromium it
wheels the page to its end and back at desktop, phone and tall desktop sizes,
follows each nav link and a deep link, and hovers each chart's points. It
reports:

- which components rendered, counted through the React DevTools hook, and how
  often the page read layout (`getBoundingClientRect`, `getComputedStyle`);
- script time over the scroll pass under 4x CPU throttling, split into React's
  render and commit work and the page's layout reads (`getBoundingClientRect`,
  `getComputedStyle`), the median of five runs;
- the section the nav marks and the URL's `chart` after every step, so two
  builds' JSON reports show whether the nav behaves the same.

The unminified build replaces `dist/`; build again before deploying.

## Shared Links

Every view lives in the URL, but the site is prerendered once, with the
default view. A link that sets view params hydrates with that default and
draws its own view straight after, hidden until it has, so it neither fails
hydration nor shifts. To check a set of shared links against the build:

```bash
bun run check-shared-links
```

It builds first, opens each link at a desktop and a phone width, and fails on
any console error (React's hydration error #418 among them), a view left
hidden, the wrong benchmark, or a view that shows before slow scripts have
run. That last case holds the scripts back for 3 s: a bundle that is slow or
never loads keeps the view hidden for 10 s (`src/styles.css`), so a shorter net
would flash the default view and shift the layout. It prints each link's layout
shift too. Like the brand images, it needs Chromium for `playwright-core`.

## Comparison Fit

Pin a point and hover another, and the tooltip compares them in a table whose
columns take their content's width. To check it fits:

```bash
bun run check-comparison-fit
```

It builds first, then compares the cheapest point with the priciest (the
widest change chip) and a spread of other pairs at 360px, 390px and desktop
widths, and fails if a figure or chip breaks over two lines or the table spills
out of its card. Phones narrower than 360px are out of scope.

## Complexity Smoke

Before a refactor, record screenshots of the built page, then compare the
refactored build against them:

```bash
bun run complexity-smoke -- --out /tmp/before
bun run complexity-smoke -- --out /tmp/after --compare /tmp/before
```

It builds first, serves `dist/client` (or opens `--origin URL`), and at a
desktop and a phone width checks point pinning, overflow arrows and section
jumps. At the desktop width only, it also checks the chart settings menu,
including that an Escape that closes the menu keeps a pinned point open. With
`--compare` it also fails on screenshots that differ. `--compare` must not be
the `--out` directory.

## Paint Metrics

```bash
vp build && bun run measure-paint
```

serves `dist/client` and loads `/` cold five times (`--runs N`, a positive whole number, for more) on a
phone viewport, throttled like Lighthouse's mobile preset (`--throttle
desktop` for the desktop one). The first request to any other origin waits
three round trips for DNS, TCP, and TLS, which Chromium's throttle leaves out.
It prints the median first paint, first contentful paint, largest contentful
paint, cumulative layout shift, and when the last web font arrived. It then
opens each `?benchmark=` view and fails if the selected benchmark ends up
under the benchmark picker's edge fade once the fonts have loaded. Each
view holds its font request until the benchmark is revealed in the fallback
face, so a swap that pushes it under the fade fails the run.

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### DM Sans Fallback

`src/styles.css` defines "DM Sans Fallback", a local Arial (or a metric twin)
sized to DM Sans, so text barely moves when the web font swaps in.
`size-adjust` is DM Sans's width divided by Arial's over the page's own text
at each element's weight, measured at 1000px so hinting cannot round it. The
overrides are DM Sans's ascent (992) and descent (310) per 1000 units, divided
by `size-adjust`. Android ships none of these fonts, so there the text first
paints in unadjusted Roboto and still shifts at the swap.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Remove `@tailwindcss/vite` and `tailwindcss` from `package.json`

## Linting & Formatting

This project uses oxlint and oxfmt through Vite+, configured in the `lint` and
`fmt` blocks of `vite.config.ts`:

```bash
vp lint
vp fmt
vp check # format, lint, and type-aware checks together
```

`vite.config.ts` points type-aware lint at tsrs-lint and sets `typeCheck`, so
lint also reports TypeScript's compiler errors. There is no separate typecheck
command. `bun run format` and `bun run lint` run the same two steps.



## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    getServerTime().then(setTime)
  }, [])
  
  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).



# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
