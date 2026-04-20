# MostLogin Extension Import

## Purpose

Import the live extension bundle from the local MostLogin installation into Patchright's `.extensions` directory, update the pinned extension manifest used by runtime selection, and run a local full-bundle smoke before any Railway canary.

## Default Import Source On This Mac

The `npm run import:mostlogin:extensions` script is wired to the MostLogin shared extension cache:

```bash
$HOME/Library/Application Support/MostLogin/chromeExtension
```

That cache contains the full installed extension set from the current MostLogin instance and is a better import source than the profile-local `Default/Extensions` tree, which may only contain a partial set of active/system extensions.

## Import The Live MostLogin Bundle

Run:

```bash
npm run import:mostlogin:extensions
```

What it does:

- reads extensions from the MostLogin shared cache
- copies them into the workspace `.extensions/`
- updates `src/extensions/manifest.json`
- prints the imported slug list and bundle hash

## Important Slug Rule

After import, the manifest may contain both:

- old hand-named slugs like `similarweb` and `keywords-everywhere`
- imported extension-ID slugs like `hoklmmgfnpapgjgcpechhaamimifchmp`

For full-bundle Patchright runs, prefer the imported extension-ID slugs to avoid duplicate variants of the same extension.

## Imported SEO / Market-Research Slugs

Use these imported IDs for the SEO and market-research bundle:

```bash
2c9644389d22ef69019d26a247c3683d
dapjbgnjinbpoindlpdmhochffioedbn
eakacpaijcpapndcfffdgphdiccmpknp
gppongmhjkpfnbhagpmjfkannfbllamg
hbapdpeemoojbophdfndmlgdhppljgmp
hgmoccdbjhknikckedaaebbpdeebhiei
hoklmmgfnpapgjgcpechhaamimifchmp
```

The shared cache currently contains two Similarweb-like variants. For experiment control, choose one Similarweb variant intentionally instead of loading both.

## Full Imported Bundle Smoke

Build first:

```bash
npm run build
```

Run a one-round local Patchright smoke with the imported bundle only:

```bash
PROFILE_SOURCE=mostlogin \
PATCHRIGHT_EXTENSION_SLUGS="2c9644389d22ef69019d26a247c3683d,bkkbcggnhapdmkeljlodobbkopceiche,chhjbpecpncaggjpdakmflnfcopglcmi,chphlpgkkbolifaimnlloiipkdnihall,dapjbgnjinbpoindlpdmhochffioedbn,eakacpaijcpapndcfffdgphdiccmpknp,eiimnmioipafcokbfikbljfdeojpcgbh,gogbiohkminacikoppmljeolgccpmlop,gppongmhjkpfnbhagpmjfkannfbllamg,hbapdpeemoojbophdfndmlgdhppljgmp,hgmhmanijnjhaffoampdlllchpolkdnj,hgmoccdbjhknikckedaaebbpdeebhiei,jlgkpaicikihijadgifklkbpdajbkhjo,kkelicaakdanhinjdeammmilcgefonfh,mlomiejdfkolichcflejclcbmpeaniij" \
CONCURRENCY=1 \
MIN_CONCURRENCY=1 \
POOL_SIZE=1 \
TOTAL_ROUNDS=1 \
ROUND_TIMEOUT_MS=300000 \
SESSION_TIMEOUT_MS=180000 \
npm run start:patchright
```

## Latest Local Smoke Result

Observed result from the current workspace:

- Patchright accepted the imported extension bundle and logged the selected imported IDs
- `PROFILE_SOURCE=mostlogin` loaded the live MostLogin catalog successfully
- the session fetched a proxy and completed homepage, pricing, and footer/legal browsing
- the run later timed out during top-up after the page/context had already closed

Interpretation:

- extension import and bundle loading are working
- MostLogin-backed Patchright launch is working with the imported bundle
- there is still an operational timeout/top-up issue to watch, but the import lane itself is viable

## Railway Canary: Concurrency 10

Use one Railway worker first, not 10 replicas.

Recommended env:

```bash
PROFILE_SOURCE=mostlogin
RAILWAY_ENVIRONMENT=1
PATCHRIGHT_EXTENSION_SLUGS="<imported extension-id list only>"
CONCURRENCY=10
MIN_CONCURRENCY=10
POOL_SIZE=20
TOTAL_ROUNDS=1000
ROUND_TIMEOUT_MS=600000
SESSION_TIMEOUT_MS=300000
SESSION_LAUNCH_STAGGER_MS=3000
```

Notes:

- Keep `POOL_SIZE` above `CONCURRENCY` so the worker can rotate identities.
- Do not scale to 10 Railway replicas until the single-worker concurrency-10 canary is stable.
- If later scaling to replicas, set `REPLICA_SHARD_COUNT` and a unique `REPLICA_SHARD_INDEX` per replica.
- Keep `PATCHRIGHT_EXTENSION_SLUGS` to the imported extension-ID set only. Avoid legacy alias slugs that would duplicate imported variants.
