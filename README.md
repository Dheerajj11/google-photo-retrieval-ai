# Memory Guided Photos — Product 2

A deployable React/Vite graduation-project MVP for **vaguely remembered photo retrieval**.

## What this app demonstrates

This is an end-user retrieval product, not the Recall Lab research analyser.

- **Photos** — Google Photos-inspired demo library
- **Search** — simple keyword baseline
- **Memory Search** — natural-language vague-memory retrieval
- editable **Certain / Approximate / Guess / Unknown** clues
- free browser-side CLIP image/text retrieval when the model loads
- graceful local metadata fallback if the browser/model cannot load
- ranked real image candidates
- large photo inspection
- recovered-memory refinement
- relax/disable/remove uncertain clues
- candidate-grounded clarification
- **More like this** visual refinement
- explicit **Yes — this is the photo** confirmation
- truthful no-confirmed-match state
- task/session instrumentation and JSON export for Part 6 testing

No database, login, paid API, or persistent uploads are required.

## Run locally

1. Install Node.js 20+
2. Run `npm install`
3. Run `npm run dev`

Production check:

```
npm run build
```

## Deploy on Vercel

1. Push this repository to GitHub (it is already GitHub-ready).
2. Open Vercel and choose **Add New → Project**.
3. Import this GitHub repository.
4. Framework should be detected as **Vite**.
5. Build command: `npm run build`
6. Output directory: `dist`
7. No environment variables are required.
8. Deploy.

## Important model behaviour

The Memory Search route attempts to load an open CLIP model in the visitor's browser from Hugging Face. The first use can take time because the model must download and cache. If model loading or image CORS fails, the app explicitly switches to a local semantic/metadata fallback instead of pretending that AI ran.

For final submission evidence, record which engine is shown in the UI during each test session.

## Use the supplied project photo library

The current demo library is intentionally lightweight so the repository can deploy immediately.

For the final curated library:

1. Resize/convert selected photos from your master ZIP to web-sized JPEG/WebP copies.
2. Put those copies under `public/photos/`.
3. Edit `src/data/photos.js`.
4. Change each photo's `url` to a local path such as `/photos/photo-001.webp`.
5. Keep useful non-sensitive metadata/tags only.
6. Keep several near-duplicates and distractors so the retrieval task stays realistic.
7. Run `npm run build` before deployment.

Do **not** commit the original ~400 MB master ZIP. Keep that master archive separately.

## Privacy / inference boundary

The prototype does not infer or claim real people's identities, relationships, exact dates, or precise locations from appearance. Demo date/place fields are explicit library metadata. Visual similarity is labelled as model inference.

## Testing

For each task, the app records:
- starting memory
- candidate sets
- photos opened
- refinements and recovered clues
- clarification answers
- elapsed time
- confirmed target or no-confirmed-match outcome

Use **Export session JSON** after each test.
