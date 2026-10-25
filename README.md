# Lone Star Ballot

A self-contained static website for the Lone Star Bleeding Disorders Foundation's
annual board election results, with an archive back to 2020.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page shell (header, year nav, archive container, footer) |
| `style.css` | All styling (light + dark themes) |
| `config.js` | **Site settings — change the voting link here** |
| `data.js` | Election results data (generated) |
| `app.js` | Renders the archive from the data |
| `make_data.py` | Scrapes `raw/*.html` into `parsed_data.json` |
| `build_data_js.py` | Converts `parsed_data.json` → `data.js` |
| `raw/` | Downloaded source pages from lonestarballot.org (2020–2026) |
| `parsed_data.json` | Normalized results data |
| `404.html` | Redirects old WordPress URLs to the archive (GitHub Pages fallback) |

## Run it

No build step and no server required — just open `index.html` in a browser.
To serve it locally instead:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Change the voting link (each election)

Open **`config.js`** and edit one line:

```js
VOTE_URL: 'https://new-voting-site.example.org/',
```

Optionally set:

- `VOTING_OPEN: false` — hides the "Vote now" button and "Voting is open"
  banner, leaving an archive-only page.
- `CURRENT_YEAR: '2027'` — the featured/most recent year.

This is the only place the outbound voting link lives; nothing is hard-coded in
the page.

## Add next year's results

1. Download the new results page:
   ```sh
   curl -sL "https://www.lonestarballot.org/poll/2027-lone-star-board-ballot/" -o raw/2027.html
   ```
2. Regenerate the data:
   ```sh
   python3 make_data.py
   python3 build_data_js.py
   ```
3. Update `CURRENT_YEAR` (and `VOTE_URL`) in `config.js`.

Each year is directly linkable too — `index.html#2027` jumps to that year.

## Redirects from the old site

When this site replaces `lonestarballot.org`, every old WordPress URL that no
longer exists lands on `404.html`, which redirects:

- `/poll/2020-board/`, `/poll/2025-lone-star-board-ballot/`, etc. → `/#2020`, `/#2025`
- anything else (`/feed/`, `/wp-json/…`, `/xmlrpc.php`) → `/` (archive homepage)

The year anchors highlight the matching tab and jump to that year's results.
This relies on GitHub Pages serving `404.html` for unknown paths — `python3 -m
http.server` does not, so it can only be tested after deploying.

## Notes on the data

The old site is a WordPress instance using the TotalPoll plugin, and its markup
changed between years. `make_data.py` handles both formats:

- **2020–2024** — one question per office; candidate names and vote shares in
  "choice items", bios in content blocks (some wrapped in `<p>`, some bare).
- **2025–2026** — one question per *Office – Candidate*; YES/NO votes with the
  candidate statement in the question body.

Vote shares are taken from the rendered bar widths / vote text and are stored
as percentages. All years reconcile to 100%.
