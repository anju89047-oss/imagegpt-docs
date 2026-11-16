// Generates per-model documentation pages, playground overview pages, and the
// sidebar from imagegpt-api-docs.json.
//
// Usage: node scripts/generate-model-pages.mjs  (or: npm run gen:models)
//
// Re-run this whenever imagegpt-api-docs.json changes. It only manages the four
// playground folders (text/image/video/audio) and sidebars.ts; it never touches
// intro.mdx or authentication.mdx.

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const docsDir = path.join(root, 'docs');
const data = JSON.parse(
  fs.readFileSync(path.join(root, 'imagegpt-api-docs.json'), 'utf8'),
);

const FENCE = '```';
const BT = '`';
const API = data.meta.baseUrl;
const order = ['text-generation', 'image-generation', 'video-generation', 'audio-generation'];

// Example content used in the request samples and the live playground.
const SAMPLE = {
  textPrompt:
    'Build a simple Tic Tac Toe game using only HTML, CSS, and JavaScript with two-player turn-by-turn gameplay and a restart button after the game ends.',
  textSystem: 'You are a friendly assistant.',
  imagePrompt:
    'Photorealistic portrait of the same person (keep his real face unchanged). A man with medium curly brown hair, light skin, and soft features sits relaxed, forearms on a light blue table, holding a small white puppy with a red collar. He wears a cozy color-block knitted sweater (beige, tan, light blue, black) with ribbed neck and cuffs, a silver watch, and a turquoise-beaded bracelet. Soft diffused lighting, smooth steel-blue background, slightly elevated front angle warm, intimate, digital photo',
  imageUrl:
    'https://ai.imagegpt.online/sample/437104513_792860259041679_1643623203130153012_n.jpg',
  videoPrompt: 'A serene sunset over the ocean with gentle waves',
  videoImageUrl:
    'https://provey-media.sgp1.cdn.digitaloceanspaces.com/generated/ac20c35c-07fa-464e-aa24-b172fba616a4-1782224538204.jpg',
  audioPrompt:
    'ImageGPT is an AI platform to generate images, videos, audio, code, and chat responses using multiple advanced models in one place.',
};

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function cell(s) {
  return String(s).replace(/\|/g, '\\|');
}
function frontMatter(obj) {
  return ['---', ...Object.entries(obj).map(([k, v]) => `${k}: ${v}`), '---', ''].join('\n');
}
function durationLabel(durations) {
  if (!durations || durations.length === 0) return '—';
  const s = [...durations].sort((a, b) => a - b);
  const consecutive = s.every((v, i) => i === 0 || v === s[i - 1] + 1);
  return consecutive && s.length > 2 ? `${s[0]}–${s[s.length - 1]}` : s.join(', ');
}
function creditsPerSecondLabel(map) {
  return Object.entries(map).map(([res, c]) => `${res}: ${c}`).join(' · ');
}
// Pretty JSON that doubles as a valid JS object and (for our value types) a
// valid Python dict literal.
function pretty(obj, indent = 2) {
  return JSON.stringify(obj, null, indent);
}

// --- Per-playground configuration ----------------------------------------

// The endpoint a given model page's samples and playground target. Image models
// flagged `imageToImage` use /generate/image-image; the rest use text-to-image.
function endpointFor(id, model) {
  switch (id) {
    case 'text-generation':
      return '/generate/text';
    case 'image-generation':
      return model && model.imageToImage
        ? '/generate/image-image'
        : '/generate/text-image';
    case 'video-generation':
      return '/generate/image-video';
    case 'audio-generation':
      return '/generate/text-speech';
    default:
      return '/generate';
  }
}

const mediaKind = {
  'text-generation': 'text',
  'image-generation': 'image',
  'video-generation': 'video',
  'audio-generation': 'audio',
};

function bodyFor(id, model) {
  switch (id) {
    case 'text-generation':
      return {
        model: model.id,
        prompt: SAMPLE.textPrompt,
        system: SAMPLE.textSystem,
        outputType: 'text',
      };
    case 'image-generation':
      // Only image-to-image models carry the `image` input array.
      return model.imageToImage
        ? {
            prompt: SAMPLE.imagePrompt,
            width: 512,
            height: 512,
            model: model.id,
            outputType: 'binary',
            outputFormat: 'png',
            image: [SAMPLE.imageUrl],
          }
        : {
            prompt: SAMPLE.imagePrompt,
            width: 512,
            height: 512,
            model: model.id,
            outputType: 'binary',
            outputFormat: 'png',
          };
    case 'video-generation': {
      const durations = [...model.durations].sort((a, b) => a - b);
      const duration = durations.includes(4) ? 4 : durations[0];
      const resolution = model.resolutions.includes('720p')
        ? '720p'
        : model.resolutions[0];
      return {
        prompt: SAMPLE.videoPrompt,
        model: model.id,
        aspect_ratio: '16:9',
        duration,
        resolution,
        image: [SAMPLE.videoImageUrl],
      };
    }
    case 'audio-generation':
      return {
        prompt: SAMPLE.audioPrompt,
        model: model.id,
        outputType: 'binary',
        voice: 'alloy',
        outputFormat: 'mp3',
      };
    default:
      return {model: model.id};
  }
}

// --- Code sample generators ----------------------------------------------

function curlSample(id, body, ep) {
  return `curl -X POST ${API}${ep} \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '${JSON.stringify(body)}'`;
}

function jsSample(id, body, ep) {
  const head = `fetch('${API}${ep}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY'
  },
  body: JSON.stringify(${pretty(body)})
})`;
  switch (id) {
    case 'text-generation':
      return `${head}
  .then(res => res.text())
  .then(console.log);`;
    case 'image-generation':
      return `${head}
  .then(res => res.blob())
  .then(blob => {
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    document.body.appendChild(img);
  });`;
    case 'audio-generation':
      return `${head}
  .then(res => res.blob())
  .then(blob => {
    const audio = new Audio(URL.createObjectURL(blob));
    audio.play();
  });`;
    case 'video-generation':
      return `${head}
  .then(res => res.json())
  // Returns a taskId. Retrieve the finished video with the Check Video Status API.
  .then(data => console.log(data));`;
    default:
      return head;
  }
}

function pythonSample(id, body, ep) {
  const py = pretty(body, 4).replace(/\n/g, '\n    ');
  switch (id) {
    case 'text-generation':
      return `import requests

resp = requests.post(
    "${API}${ep}",
    headers={"x-api-key": "YOUR_API_KEY"},
    json=${py},
)
print(resp.text)`;
    case 'image-generation':
      return `import requests

resp = requests.post(
    "${API}${ep}",
    headers={"x-api-key": "YOUR_API_KEY"},
    json=${py},
)
with open("image.png", "wb") as f:
    f.write(resp.content)`;
    case 'audio-generation':
      return `import requests

resp = requests.post(
    "${API}${ep}",
    headers={"x-api-key": "YOUR_API_KEY"},
    json=${py},
)
with open("speech.mp3", "wb") as f:
    f.write(resp.content)`;
    case 'video-generation':
      return `import requests

resp = requests.post(
    "${API}${ep}",
    headers={"x-api-key": "YOUR_API_KEY"},
    json=${py},
)
# Returns a taskId. Retrieve the finished video with the Check Video Status API.
print(resp.json())`;
    default:
      return '';
  }
}

function codeTabs(id, model) {
  const body = bodyFor(id, model);
  const ep = endpointFor(id, model);
  return `<Tabs groupId="lang">
<TabItem value="curl" label="cURL">

${FENCE}bash
${curlSample(id, body, ep)}
${FENCE}

</TabItem>
<TabItem value="js" label="JavaScript">

${FENCE}js
${jsSample(id, body, ep)}
${FENCE}

</TabItem>
<TabItem value="python" label="Python">

${FENCE}python
${pythonSample(id, body, ep)}
${FENCE}

</TabItem>
</Tabs>`;
}

// --- Shared page sections -------------------------------------------------

function headersSection() {
  const a = data.meta.authentication;
  return `## Headers

Send your API key in the \`${a.headerName}\` header on every request. See
[Authentication](../authentication.mdx) for details.

| Header | Required | Value |
| --- | --- | --- |
| \`${a.headerName}\` | Yes | \`YOUR_API_KEY\` |
| \`Content-Type\` | Yes | \`application/json\` |

A missing or invalid key returns **${cell(a.errorOnMissing)}**.`;
}

function parametersSection(page, endpoint) {
  const rows = page.requestBody
    .map((f) => {
      const req = f.required ? 'Yes' : 'No';
      const def = f.default == null ? '—' : `\`${cell(f.default)}\``;
      return `| \`${cell(f.name)}\` | \`${cell(f.type)}\` | ${req} | ${def} | ${cell(f.description)} |`;
    })
    .join('\n');
  return `## Parameters

Request body fields for \`${endpoint}\`:

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
${rows}`;
}

function responsesSection(page) {
  if (!page.responses || page.responses.length === 0) return '';
  const blocks = page.responses
    .map((r) => {
      const title = [r.stage, r.outputType].filter(Boolean).join(' · ');
      const heading = title ? `**${title}**` : '**Response**';
      const desc = r.description ? `\n\n${r.description}` : '';
      const lang = r.format === 'json' ? 'json' : r.format === 'javascript' ? 'js' : 'text';
      return `${heading}${desc}\n\n${FENCE}${lang}\n${r.example}\n${FENCE}`;
    })
    .join('\n\n');
  return `## Response example

${blocks}`;
}

// Short link to the standalone status page, shown on video model pages.
function videoStatusLink() {
  return `:::tip Asynchronous model
Submitting a task returns a \`taskId\`. Poll the result with the
[Check Video Status](./video-status.mdx) API.
:::`;
}

// Standalone page documenting GET /generate/video-status.
function videoStatusPage() {
  const page = data.pages['video-generation'];
  const ep = page.endpoints.find((e) => e.method === 'GET');
  const rows = (ep.query || [])
    .map((q) => {
      const req = q.required ? 'Yes' : 'No';
      const def = q.default == null ? '—' : `\`${cell(q.default)}\``;
      return `| \`${cell(q.name)}\` | ${req} | ${def} | ${cell(q.description)} |`;
    })
    .join('\n');
  const curl = `curl "${API}${ep.path}?taskId=TASK_ID&outputType=url" \\
  -H "x-api-key: YOUR_API_KEY"`;
  const js = `fetch('${API}${ep.path}?taskId=TASK_ID&outputType=url', {
  headers: { 'x-api-key': 'YOUR_API_KEY' }
})
  .then(r => r.json())
  .then(data => console.log(data));`;
  const py = `import requests

status = requests.get(
    "${API}${ep.path}",
    headers={"x-api-key": "YOUR_API_KEY"},
    params={"taskId": "TASK_ID", "outputType": "url"},
).json()
print(status)`;
  const statusResponses = page.responses.filter((r) => r.stage === 'status');
  const responseBlocks = statusResponses
    .map((r) => {
      const heading = `**outputType: ${r.outputType}**`;
      const desc = r.description ? `\n\n${r.description}` : '';
      const lang = r.format === 'json' ? 'json' : r.format === 'javascript' ? 'js' : 'text';
      return `${heading}${desc}\n\n${FENCE}${lang}\n${r.example}\n${FENCE}`;
    })
    .join('\n\n');

  const fm = frontMatter({
    id: 'video-status',
    title: 'Check Video Status',
    sidebar_label: 'Check Video Status',
  });
  const imports = `import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import ApiPlayground from '@site/src/components/ApiPlayground';
`;
  const body = `# Check Video Status

Video generation is asynchronous. A submit call to
[\`/generate/text-video\`](./index.mdx) or [\`/generate/image-video\`](./index.mdx)
returns a \`taskId\` immediately. Poll this endpoint until \`status\` is
\`success\`, then read the video \`url\`.

\`GET ${ep.path}\`

${ep.description}

## Headers

| Header | Required | Value |
| --- | --- | --- |
| \`${data.meta.authentication.headerName}\` | Yes | \`YOUR_API_KEY\` |

## Query parameters

| Parameter | Required | Default | Description |
| --- | --- | --- | --- |
${rows}

## Examples

<Tabs groupId="lang">
<TabItem value="curl" label="cURL">

${FENCE}bash
${curl}
${FENCE}

</TabItem>
<TabItem value="js" label="JavaScript">

${FENCE}js
${js}
${FENCE}

</TabItem>
<TabItem value="python" label="Python">

${FENCE}python
${py}
${FENCE}

</TabItem>
</Tabs>

## Response example

${responseBlocks}

## Playground

Paste a \`taskId\` from a video submit call and fetch its current status. Your key
is used only in your browser and is never stored.

<ApiPlayground
  endpoint="${ep.path}"
  method="GET"
  media="video"
  queryParams={[
    {name: 'taskId', label: 'taskId'},
    {name: 'outputType', label: 'outputType', default: 'url', options: ['url', 'binary']},
  ]}
/>

:::note
${page.notes[0]}
:::`;
  return fm + imports + '\n' + body + '\n';
}

function pricingForModel(page, model) {
  const p = page.pricing;
  if (page.id === 'video-generation') {
    const durations = [...model.durations].sort((a, b) => a - b);
    const d = durations.includes(4) ? 4 : durations[0];
    const res = model.resolutions.includes('720p') ? '720p' : model.resolutions[0];
    const rows = Object.entries(model.creditsPerSecond)
      .map(([r, c]) => `| ${r} | ${c} |`)
      .join('\n');
    return `## Pricing

Charged in **${p.unit}**. ${p.notes}

| Resolution | Credits / second |
| --- | --- |
${rows}

For example, a ${d}s clip at ${res} costs ${d * model.creditsPerSecond[res]} credits.`;
  }
  return `## Pricing

**${model.credits}** ${p.unit}. ${p.notes || ''}`.trim();
}

function playgroundSection(page, model) {
  const bodyStr = pretty(bodyFor(page.id, model));
  // Video shows the raw create response (taskId); it does not poll.
  const media = page.id === 'video-generation' ? 'text' : mediaKind[page.id];
  const asyncAttr = '';
  const hasImageInput =
    page.id === 'video-generation' ||
    (page.id === 'image-generation' && model.imageToImage);
  const imageNote = hasImageInput
    ? ' This example sends an input image URL; swap it for your own.'
    : '';
  return `## Playground

Try this model live. Your key is used only in your browser to call the API
directly and is never stored.${imageNote}

<ApiPlayground
  endpoint="${endpointFor(page.id, model)}"
  media="${media}"${asyncAttr}
  defaultBody={${BT}${bodyStr}${BT}}
/>

:::note
The browser playground calls \`${API}\` directly, so it only works if the API
allows cross-origin requests from this site. If it is blocked, use the cURL,
JavaScript, or Python samples above from your own server.
:::`;
}

function propsTable(page, model) {
  const rows = [
    `| Model ID | \`${cell(model.id)}\` |`,
    `| Playground | [${page.sidebar_label}](./index.mdx) |`,
  ];
  if (page.id === 'video-generation') {
    rows.push(`| Durations (s) | ${durationLabel(model.durations)} |`);
    rows.push(`| Resolutions | ${model.resolutions.join(', ')} |`);
    rows.push(`| Pricing | ${creditsPerSecondLabel(model.creditsPerSecond)} (credits/s) |`);
  } else {
    rows.push(`| Pricing | ${model.credits} ${page.pricing.unit} |`);
  }
  return `| Property | Value |
| --- | --- |
${rows.join('\n')}`;
}

// --- Model page -----------------------------------------------------------

function introLine(page, model) {
  const id = `\`${model.id}\``;
  switch (page.id) {
    case 'text-generation':
      return `A text model (${id}) available through the ImageGPT [${page.title}](./index.mdx).`;
    case 'image-generation':
      return model.imageToImage
        ? `An image-to-image model (${id}) available through the ImageGPT [${page.title}](./index.mdx). The example below uses image-to-image (\`/generate/image-image\`) with an input image.`
        : `A text-to-image model (${id}) available through the ImageGPT [${page.title}](./index.mdx). The example below uses text-to-image (\`/generate/text-image\`).`;
    case 'video-generation':
      return `A video model (${id}) available through the ImageGPT [${page.title}](./index.mdx). The example below uses image-to-video (\`/generate/image-video\`) and returns a \`taskId\`.`;
    case 'audio-generation':
      return `A text-to-speech model (${id}) available through the ImageGPT [${page.title}](./index.mdx).`;
    default:
      return '';
  }
}

function modelPage(page, model) {
  const slug = slugify(model.id);
  const fm = frontMatter({id: slug, title: model.name, sidebar_label: model.name});
  const imports = `import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import ApiPlayground from '@site/src/components/ApiPlayground';
`;
  const sections = [
    `# ${model.name}`,
    introLine(page, model),
    propsTable(page, model),
    headersSection(),
    parametersSection(page, endpointFor(page.id, model)),
    page.id === 'video-generation' ? videoStatusLink() : '',
    `## Request examples\n\n${codeTabs(page.id, model)}`,
    responsesSection(page),
    pricingForModel(page, model),
    playgroundSection(page, model),
  ].filter(Boolean);
  return fm + imports + '\n' + sections.join('\n\n') + '\n';
}

// --- Overview page --------------------------------------------------------

function endpointsTable(page) {
  const rows = page.endpoints
    .map((e) => `| \`${e.method}\` | \`${cell(e.path)}\` | ${cell(e.description)} |`)
    .join('\n');
  return `## Endpoints

| Method | Path | Description |
| --- | --- | --- |
${rows}`;
}
function examplesSection(page) {
  if (!page.examples || page.examples.length === 0) return '';
  const blocks = page.examples
    .map(
      (ex) =>
        `${FENCE}${ex.lang === 'javascript' ? 'js' : ex.lang} title="${ex.label}"\n${ex.code}\n${FENCE}`,
    )
    .join('\n\n');
  return `## Examples

${blocks}`;
}
function notesSection(page) {
  if (!page.notes || page.notes.length === 0) return '';
  return page.notes.map((n) => `:::note\n${n}\n:::`).join('\n\n');
}
function overviewPricing(page) {
  const p = page.pricing;
  let out = `## Pricing

Charged in **${p.unit}**.${p.notes ? ` ${p.notes}` : ''}`;
  if (p.tiers) {
    const rows = p.tiers
      .map((t) => `| ${cell(t.label)} | ${cell(t.range)} | ${cell(t.description)} | ${cell(t.examples)} |`)
      .join('\n');
    out += `

| Tier | Range | Description | Examples |
| --- | --- | --- | --- |
${rows}`;
  }
  return out;
}
function modelsTable(page) {
  if (page.id === 'video-generation') {
    const rows = page.models
      .map((m) => {
        const slug = slugify(m.id);
        return `| [${cell(m.name)}](./${slug}.mdx) | \`${cell(m.id)}\` | ${durationLabel(m.durations)} | ${m.resolutions.join(', ')} | ${creditsPerSecondLabel(m.creditsPerSecond)} |`;
      })
      .join('\n');
    return `## Models

Each model has its own page with parameters, examples, and a live playground.

| Model | Model ID | Durations (s) | Resolutions | Credits/s |
| --- | --- | --- | --- | --- |
${rows}`;
  }
  const unit =
    page.id === 'text-generation'
      ? 'Credits / 1K tokens'
      : page.id === 'image-generation'
        ? 'Credits / image'
        : 'Credits / request';
  const rows = page.models
    .map((m) => {
      const slug = slugify(m.id);
      return `| [${cell(m.name)}](./${slug}.mdx) | \`${cell(m.id)}\` | ${m.credits} |`;
    })
    .join('\n');
  return `## Models

Each model has its own page with parameters, examples, and a live playground.

| Model | Model ID | ${unit} |
| --- | --- | --- |
${rows}`;
}

function overviewPage(page) {
  const fm = frontMatter({
    id: 'index',
    title: page.title,
    sidebar_label: 'Overview',
    slug: `/${page.id}`,
  });
  const statusTip =
    page.id === 'video-generation'
      ? ':::tip Asynchronous\nSubmitting a task returns a `taskId`. Retrieve the finished video with the [Check Video Status](./video-status.mdx) API.\n:::'
      : '';
  const sections = [
    `# ${page.title}`,
    page.overview,
    endpointsTable(page),
    statusTip,
    parametersSection(page, page.endpoints[0].path),
    notesSection(page),
    responsesSection(page),
    examplesSection(page),
    overviewPricing(page),
    modelsTable(page),
  ].filter(Boolean);
  return fm + sections.join('\n\n') + '\n';
}

// --- Generation -----------------------------------------------------------

const sidebarCategories = [];

for (const id of order) {
  const page = data.pages[id];
  const dir = path.join(docsDir, id);

  const oldFile = path.join(docsDir, `${id}.mdx`);
  if (fs.existsSync(oldFile)) fs.rmSync(oldFile);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});

  fs.writeFileSync(path.join(dir, 'index.mdx'), overviewPage(page));

  const modelIds = [];

  for (const model of page.models) {
    const slug = slugify(model.id);
    fs.writeFileSync(path.join(dir, `${slug}.mdx`), modelPage(page, model));
    modelIds.push(`${id}/${slug}`);
  }

  // Video gets a standalone status page listed last in its section.
  if (id === 'video-generation') {
    fs.writeFileSync(path.join(dir, 'video-status.mdx'), videoStatusPage());
    modelIds.push(`${id}/video-status`);
  }

  sidebarCategories.push({label: page.sidebar_label, overviewId: `${id}/index`, modelIds});
}

// --- Sidebar --------------------------------------------------------------

function renderSidebar() {
  const cats = sidebarCategories
    .map((c) => {
      const items = c.modelIds.map((m) => `            '${m}',`).join('\n');
      return `        {
          type: 'category',
          label: '${c.label}',
          link: {type: 'doc', id: '${c.overviewId}'},
          items: [
${items}
          ],
        },`;
    })
    .join('\n');
  return `import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// AUTO-GENERATED by scripts/generate-model-pages.mjs. Do not edit by hand.
// Re-run \`npm run gen:models\` to regenerate after changing the source JSON.
const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'authentication',
    {
      type: 'category',
      label: 'Playgrounds',
      collapsed: false,
      items: [
${cats}
      ],
    },
  ],
};

export default sidebars;
`;
}

fs.writeFileSync(path.join(root, 'sidebars.ts'), renderSidebar());

const total = order.reduce((n, id) => n + data.pages[id].models.length, 0);
console.log(`Generated ${order.length} overview pages and ${total} model pages.`);
