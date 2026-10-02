# tenor-proxy

lets be honest tenor has the best gifs but since they shut off their api, every app has to use a different gif provider and they all suck ass. solution? just scrape the search results lol

[try it](https://tenor-proxy.vercel.app/api/search?q=cat&limit=3) · [docs](https://tenor-proxy.vercel.app) · [openapi](https://tenor-proxy.vercel.app/openapi.json)

## use it

```sh
curl 'https://tenor-proxy.vercel.app/api/search?q=happy%20cat&limit=10'
```

`q` is required, max 100 characters. `limit` is 1–50, defaults to 20. that's the entire api. don't send random params or the same one twice.

you get `{ query, count, results }`. each result has:

- `gif`: the actual gif url
- `preview`: a still image, or a smaller gif if there's no still
- `url`: the tenor page. keep it around for attribution
- `id`, `title`, `description`, `width`, `height`
- `media`: whatever gif/mp4/webp/webm variants tenor has

ids are strings because javascript numbers can't be trusted with big ones. dimensions can be null. render titles and descriptions as text, not html.

CORS is open. errors look like `{ error: { code, message } }`: 400 for bad input, 405 for the wrong method, 502 when tenor breaks, 504 when it takes too long.

## the catch

we can only fetch the first page only, max 50 results. no pagination, trending, or filter knobs... tenor's default filter is not a promise that everything is kid-safe either soo uhhh do with that what you will.

this proxies search data, not the actual gif bytes. your client downloads media from tenor. uncached searches get one request, an 8-second timeout, and a 4 MiB response limit. successful searches cache for 60 seconds in browsers and 10 minutes on vercel, with up to an hour of stale-while-revalidate. errors don't cache.

this also uses a revolutionary web technology called *scraping*. if tenor changes the page or blocks my shit, it breaks. i will try my best to keep this shit running but i make no promises.

also: public endpoint + unlimited unique searches = your bill. set vercel firewall rate limits before telling the entire internet about your instance. there is no built-in rate limiter.
