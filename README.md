# ImageGPT API Documentation

Documentation site for the [ImageGPT API](https://api.imagegpt.online) —
a unified REST API for generating text, images, video, and audio from 40+ AI
models through a single endpoint with credit-based pricing.

Built with [Docusaurus](https://docusaurus.io/).

## Content

The docs are generated from `imagegpt-api-docs.json` and live in `docs/`:

- `intro.mdx` — overview and base URL
- `authentication.mdx` — API key / `x-api-key` header
- `text-generation.mdx` — Text playground
- `image-generation.mdx` — Image playground
- `video-generation.mdx` — Video playground (async)
- `audio-generation.mdx` — Audio / text-to-speech playground

The site is docs-only and served at the root (`routeBasePath: '/'`).

## Local development

```bash
npm install
npm start
```

Starts a local dev server at http://localhost:3000 and opens a browser window.
Most changes are reflected live without restarting.

## Build

```bash
npm run build
```

Generates static content into the `build` directory. Serve it locally with:

```bash
npm run serve
```
