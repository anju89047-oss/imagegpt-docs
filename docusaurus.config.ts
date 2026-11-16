import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'ImageGPT API',
  tagline:
    'Generate text, images, video, and audio from 40+ AI models through a single endpoint.',
  favicon: 'img/imagegpt-favicon-32x32.png',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://docs.imagegpt.online',
  // Set the /<baseUrl>/ pathname under which your site is served
  baseUrl: '/',

  organizationName: 'imagegpt',
  projectName: 'imagegpt-docs',

  onBrokenLinks: 'throw',

  headTags: [
    {
      tagName: 'meta',
      attributes: {name: 'theme-color', content: '#3b82f6'},
    },
  ],

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Serve the docs at the site root.
          routeBasePath: '/',
        },
        // Blog is not used for this API documentation site.
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/imagegpt-nano_banana.jpeg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'ImageGPT API',
      logo: {
        alt: 'ImageGPT Logo',
        src: 'img/imagegpt-android-chrome-512x512.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://www.imagegpt.online/models/documentation',
          label: 'Live Docs',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Introduction', to: '/'},
            {label: 'Authentication', to: '/authentication'},
          ],
        },
        {
          title: 'Playgrounds',
          items: [
            {label: 'Text', to: '/text-generation'},
            {label: 'Image', to: '/image-generation'},
            {label: 'Video', to: '/video-generation'},
            {label: 'Audio', to: '/audio-generation'},
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Documentation (imagegpt.online)',
              href: 'https://www.imagegpt.online/models/documentation',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ImageGPT.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'php'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
