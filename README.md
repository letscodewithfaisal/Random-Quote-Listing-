# The Commonplace — Quotes Catalog

A quote-browsing app built for the **FreeAPI Quotes Listing Application** brief (Web Dev Cohort 2026). It presents quotes from the [FreeAPI Quotes endpoint](https://api.freeapi.app/api/v1/public/quotes) as a library card catalog: a "pull a card" random quote feature, a searchable/filterable grid of index cards, and paginated loading straight from the API.

## Live demo
_Add your hosted link here after deploying (see below)._

## Features
- Fetches quotes directly from `GET https://api.freeapi.app/api/v1/public/quotes` (paginated, 20 per page)
- **Pull a card** — surfaces a random quote, occasionally reaching into an unloaded page from the API
- **Search** by author or any word in the quote, filtered client-side over loaded cards
- **Subject label filter** — chips built from each quote's `tags`
- **Open the next drawer** — loads additional pages on demand instead of fetching all 300 quotes at once
- No build step, no dependencies — plain HTML/CSS/JS

## Project structure
```
quotes-app/
├── index.html    # markup
├── style.css     # card-catalog visual design
├── script.js     # API fetching, filtering, rendering
└── README.md
```

## Run it locally
Just open `index.html` in a browser, or serve it locally:
```bash
npx serve .
# or
python3 -m http.server 8080
```
Then visit the printed local address.

## Deploy it (for the "live hosted project link" submission)

### Option A — GitHub Pages (free, matches your GitHub repo)
1. Push this folder to a new GitHub repository.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`.
4. Save. GitHub gives you a URL like `https://<your-username>.github.io/<repo-name>/` within a minute or two.



### Option B — Vercel
1. Install the CLI (`npm i -g vercel`) or use the Vercel dashboard's "Import Project."
2. Run `vercel` inside the project folder and follow the prompts (no framework preset needed — choose "Other").

## Push to GitHub
```bash
cd quotes-app
git init
git add .
git commit -m "Quotes catalog app"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

## API notes
- Base URL: `https://api.freeapi.app/api/v1/public/quotes`
- Query params used: `page`, `limit`
- Response shape: `{ data: { data: [...quotes], page, totalPages, ... } }`
- Each quote has `author`, `content`, `tags`, `id`
