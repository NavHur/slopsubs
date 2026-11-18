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

The charts ship generated data. One command refreshes all of it:

```bash
bun run refresh-data
```

It runs four scripts in this order and stops at the first that fails, with
that script's exit code:

```bash
bun run import-benchmarks    # src/data/benchmarks.json
bun run import-aa-evals      # src/data/aa-evals.json
bun run import-frontiercode  # src/data/frontiercode.json
bun run build-plans          # plans.json and chart-benchmarks.json
```

Then it prints what changed since `HEAD` (`--base <ref>` picks another
commit): plan value multiples, list prices, scores that moved by 0.1 points or
more, and models AA added or dropped. When nothing but fetch dates moved, it
puts the files back, so the footer's "Data as of" date is when the data last
changed. `--allow-score-drift` and `--allow-missing-cost` pass through to
`import-benchmarks`, and `--summary <file.md>` saves the summary.

A scheduled agent runs it twice a day (every 12 hours), in this order:

1. Fetch and reset `data-refresh/main` to `origin/main`, then run
   `bun run refresh-data --summary <file>`, followed by any escape-hatch flags
   a maintainer named. The reset matters because `--base` defaults to `HEAD`:
   the summary compares the refreshed tree with `origin/main`, and its file is
   the PR body.
2. If the run failed, open or update the "Data refresh failing" issue with the
   failing step, the tail of its output, the run's UTC time and the
   `origin/main` commit it ran on. Then hand-patch the data from the live
   sources as [`docs/agents/data-refresh.md`](docs/agents/data-refresh.md)
   describes, keeping the last good rows the scripts could not refresh and
   listing them as stale in the PR body, and continue from step 4. Stop only
   where that runbook says to. A failure in any later step (4 to 6) is
   reported the same way: name that step.
3. A clean tree means nothing changed: close any open refresh PR, close the
   failure issue (comment "No data changed" and the run's UTC time, then close
   it), and stop.
4. Otherwise run `vp check` and `vp test run`. If either fails, the run failed
   at that check: stop before pushing.
5. Skip the push only when `origin/data-refresh/main` is based on the current
   `origin/main` and the last line of
   `bun scripts/data-changes.ts origin/data-refresh/main` starts "No data
   changed." (the branch already holds this data; an "Only refetched" ending
   still counts). Otherwise commit the regenerated files on `data-refresh/main`
   and force-push (with lease). That output only decides push or skip; it is
   never a PR body, and no step compares PR-body text.
6. Make sure one open draft PR exists for `data-refresh/main`. Create it with
   the step 1 summary as its body if none is open, and after a push set its
   body to that summary. If the push was skipped and a PR is open, leave its
   body alone.
7. Only now, with the checks passed and the PR in place, close the failure
   issue if one is open: comment the run's UTC time and the last line of the
   step 1 summary, then close it.

A maintainer can start a run by asking the agent in its thread to run now, and
names `--allow-score-drift` or `--allow-missing-cost` when it needs one. A
maintainer reviews and merges the PR.

[Artificial Analysis](https://artificialanalysis.ai) is the source of the
model list, Intelligence Index scores, list prices and release dates, and the
cost, tokens and time per task for the models it has run. `import-benchmarks`
reads all of them from AA model pages' flight payloads; no API key is needed.
A model page embeds full records only for its own release's variants and a few
dozen others, so the import fetches one page per plan-covered family and joins
them; two pages that read one model differently stop the import. Slopalytics
supplies the catalog and fills any point the website doesn't cover. A covered
catalog point AA does not list stops the import; an uncovered one is left out
and logged. A score they disagree on stops the import; a price they disagree
on only warns, since a promo can explain the gap, and AA's list price wins.
When AA says it regraded a benchmark, `--allow-score-drift` turns a gap of up
to 1.5 points into a warning so the refresh can proceed before slopalytics
catches up. AA's time per task is decode time, excluding TTFT and overhead.

The nine Intelligence Index evals (Terminal-Bench 4.0, FrontierCode 2.0 and
seven others) come from the same AA pages. `import-aa-evals` reads each
model's per-eval scores from its record's named fields, resolved against the
catalog (unknown families/efforts are skipped with a log; ambiguous ones stop
the import). A family the catalog has only as `default` takes the website's
row when the site lists it at one effort, and the log names it. AA's model
pages no longer carry per-eval cost, tokens or time, so the import writes the
fresh scores to `$TMPDIR/slopsubs-aa-eval-scores.json` and stops without
touching `src/data/aa-evals.json`; the refresh runbook merges them into the
committed rows.

Each script takes cached input for offline runs: `import-benchmarks` accepts
`--bundle <bundle.js>`, and both AA importers accept `--html <page.html>`,
once per cached model page. `import-frontiercode` has no flags.

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

When a script breaks on a source's new layout, the scheduled agent reads the
source in the browser and hand-patches the data instead:
[`docs/agents/data-refresh.md`](docs/agents/data-refresh.md) maps each source
to the fields it feeds and lists the known failure modes.

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

## React Doctor

[react-doctor](https://react.doctor/docs) scans the React code for bugs,
performance problems, and accessibility issues:

```bash
bun run doctor
```

`doctor.config.ts` keeps it offline (no score API, share URL, or Socket.dev
checks) and makes an error fail the run; CI runs it as the "React Doctor" job in
`verify.yml`. Warnings are fixed at the cause. A false positive gets the
narrowest suppression, with its reason beside it.



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
