# Site Profiles

Switch target website by setting:

```bash
BOT_SITE_PROFILE=eurocookflow
# or
BOT_SITE_PROFILE=focusclock
```

Profiles live in:

- `src/sites/profiles/eurocookflow.json`
- `src/sites/profiles/focusclock.json`

Validation schema:

- `src/sites/schema.ts`

How to add a new site:

1. Copy `src/sites/profiles/focusclock.json` to a new `<site>.json`.
2. Fill routes/selectors/flags for that site.
3. Import it in `src/sites/index.ts` and add it to `parsedProfiles`.
4. Set `BOT_SITE_PROFILE=<site>` in `.env`.
