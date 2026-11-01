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
model list, Intelligence Index scores, list prices and release dates, through
its data API. The API needs a key: put `AA_API_KEY=...` in `.env.local` (which
git ignores) and `bun` passes it to the script. Slopalytics still supplies the
cost, tokens and wall-clock time per task that the free API does not publish,
and the two sources are merged in `src/domain/catalog.ts`. A score they
disagree on stops the import; a price they disagree on only warns, since a
promo can explain the gap, and AA's list price wins.

The nine Intelligence Index evals (Terminal-Bench 4.0, FrontierCode 2.0 and
seven others) come from the AA website itself, not the data API, because the
API omits their per-task cost, tokens and time. `import-aa-evals` fetches a
model page, reconstructs its Next.js flight payload, and extracts each model's
per-eval score, cost, tokens and time into `src/data/aa-evals.json`, resolved
against the catalog (unknown families/efforts are skipped with a log; ambiguous
ones stop the import). A family the catalog has only as `default` takes the
website's row when the site lists it at one effort, and the log names it.

Each script takes cached input for offline runs: `import-benchmarks` accepts
`--bundle <bundle.js>`, `--aa <models.json>` and `--html <page.html>`, and
`import-aa-evals` accepts `--html <page.html>`. `import-frontiercode` has no flags.

A point slopalytics has not costed takes AA's own cost, tokens and time per
task from the same model page `import-aa-evals` reads. A model AA lists that
neither source has costed makes the import stop, so the gap is deliberate
rather than silent.
`bun run import-benchmarks -- --allow-missing-cost` writes it with a null cost
instead; the cost chart leaves it out until either source costs it.

FrontierCode 2.0 comes from Cognition's own `data.json`, not a reseller.
`build-plans` then keeps only the points some plan covers and writes the
chart's copy.

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
(`bunx playwright-core install chromium`) and network access for the web font
the export embeds.

## Paint Metrics

```bash
vp build && bun run measure-paint
```

serves `dist/client` and loads `/` cold five times (`--runs N` for more) on a
phone viewport, throttled like Lighthouse's mobile preset (`--throttle
desktop` for the desktop one). The first request to any other origin waits
three round trips for DNS, TCP, and TLS, which Chromium's throttle leaves out.
It prints the median first paint, first contentful paint, largest contentful
paint, cumulative layout shift, and when the last web font arrived. It then
opens each `?benchmark=` view and fails if the selected benchmark ends up
under the benchmark picker's edge fade once the fonts have loaded.

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

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
