import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Obsidian MCP Server',
  description: 'MCP server for Obsidian vault integration with AI assistants',

  // GitHub Pages deploy
  base: '/another-bloated-obsidian-mcp-server/',

  // Prevent Vue from interpreting {{ }} as template syntax
  vue: {
    template: {
      compilerOptions: {
        delimiters: ['${', '}$'] // Use different delimiters to avoid conflicts
      }
    }
  },

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/GETTING-STARTED' },
      { text: 'API', link: '/API_REFERENCE' },
      { text: 'GitHub', link: 'https://github.com/diegorv/another-bloated-obsidian-mcp-server' }
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Getting Started', link: '/guide/GETTING-STARTED' },
          { text: 'Configuration', link: '/CONFIGURATION' },
          { text: 'Architecture', link: '/ARCHITECTURE' }
        ]
      },
      {
        text: 'Reference',
        items: [
          { text: 'API Reference', link: '/API_REFERENCE' },
          { text: 'Error Codes', link: '/ERROR_CODES' },
          { text: 'Security', link: '/SECURITY' }
        ]
      },
      {
        text: 'Testing Guides',
        collapsed: true,
        items: [
          { text: 'Vault', link: '/TESTING/TESTING-VAULT' },
          { text: 'Notes', link: '/TESTING/TESTING-NOTES' },
          { text: 'Search', link: '/TESTING/TESTING-SEARCH' },
          { text: 'Frontmatter', link: '/TESTING/TESTING-FRONTMATTER' },
          { text: 'Tags', link: '/TESTING/TESTING-TAGS' },
          { text: 'Links', link: '/TESTING/TESTING-LINKS' },
          { text: 'Daily Notes', link: '/TESTING/TESTING-DAILY-NOTES' },
          { text: 'Templates', link: '/TESTING/TESTING-TEMPLATES' },
          { text: 'Bases', link: '/TESTING/TESTING-BASES' },
          { text: 'Batch', link: '/TESTING/TESTING-BATCH' },
          { text: 'Attachments', link: '/TESTING/TESTING-ATTACHMENTS' },
          { text: 'Backup', link: '/TESTING/TESTING-BACKUP' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/diegorv/another-bloated-obsidian-mcp-server' }
    ],

    search: {
      provider: 'local'
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024'
    }
  }
})
