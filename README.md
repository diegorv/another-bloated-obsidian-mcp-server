# Obsidian MCP Server

Servidor MCP (Model Context Protocol) para integrar o Obsidian com Claude Code e outros agentes de IA.

## Características

- Acesso direto ao filesystem (não precisa do Obsidian aberto)
- Suporte a múltiplos vaults
- **Grupos de ferramentas configuráveis** - habilite apenas o que você precisa
- Operações CRUD em notas
- Manipulação de frontmatter YAML
- Gerenciamento de tags
- Análise de links e grafo de conhecimento
- Suporte a Daily Notes
- Sistema de templates
- Integração com Obsidian Bases

## Pré-requisitos

- Node.js 18+
- Yarn (se não tiver, instale com `npm install -g yarn`)

## Instalação

```bash
# 1. Instale o yarn globalmente (se ainda não tiver)
npm install -g yarn

# 2. Navegue até o diretório do projeto
cd obsidian-mcp-server

# 3. Instale as dependências
yarn install

# 4. Build (opcional, pode rodar direto com tsx)
yarn build
```

## Configuração no Claude Code Desktop

Edite o arquivo de configuração do Claude Code Desktop:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### Exemplo: Habilitar todas as ferramentas

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "yarn",
      "args": [
        "--cwd",
        "/Users/SEU_USUARIO/Dev/obsidian-mcp-server",
        "start",
        "/Users/SEU_USUARIO/Obsidian/MeuVault"
      ]
    }
  }
}
```

### Exemplo: Habilitar apenas CRUD básico

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "yarn",
      "args": [
        "--cwd",
        "/Users/SEU_USUARIO/Dev/obsidian-mcp-server",
        "start",
        "/Users/SEU_USUARIO/Obsidian/MeuVault",
        "--tools=vault,notes,search"
      ]
    }
  }
}
```

### Exemplo: Usando variável de ambiente

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "yarn",
      "args": [
        "--cwd",
        "/Users/SEU_USUARIO/Dev/obsidian-mcp-server",
        "start",
        "/Users/SEU_USUARIO/Obsidian/MeuVault"
      ],
      "env": {
        "OBSIDIAN_MCP_TOOLS": "vault,notes,search,frontmatter"
      }
    }
  }
}
```

### Exemplo: Múltiplos vaults com configurações diferentes

```json
{
  "mcpServers": {
    "obsidian-personal": {
      "command": "yarn",
      "args": [
        "--cwd",
        "/Users/SEU_USUARIO/Dev/obsidian-mcp-server",
        "start",
        "/Users/SEU_USUARIO/Obsidian/Personal",
        "personal",
        "--tools=all"
      ]
    },
    "obsidian-work": {
      "command": "yarn",
      "args": [
        "--cwd",
        "/Users/SEU_USUARIO/Dev/obsidian-mcp-server",
        "start",
        "/Users/SEU_USUARIO/Obsidian/Work",
        "work",
        "--tools=vault,notes,search,daily"
      ]
    }
  }
}
```

## Grupos de Ferramentas Disponíveis

| Grupo | Ferramentas | Descrição |
|-------|-------------|-----------|
| `vault` | list_vaults, set_active_vault, register_vault | Gerenciamento de vaults |
| `notes` | list_notes, read_note, create_note, update_note, delete_note | CRUD de notas |
| `search` | search_vault | Busca textual no vault |
| `frontmatter` | get_frontmatter, update_frontmatter | Manipulação de metadados YAML |
| `tags` | list_tags, add_tag, remove_tag, search_by_tag | Gerenciamento de tags |
| `links` | get_outlinks, get_backlinks, find_orphans, find_broken_links, get_link_graph | Análise de links |
| `daily` | get_daily_note, create_daily_note, list_daily_notes, append_to_daily | Daily Notes |
| `templates` | list_templates, get_template, apply_template, create_from_template | Sistema de templates |
| `bases` | list_bases, get_base, query_base | Obsidian Bases (databases) |

### Valores Especiais

- `all` - Habilita todos os grupos (padrão se nada for especificado)
- `none` - Desabilita todos os grupos (útil para testes)

## Exemplos de Configuração por Caso de Uso

### Apenas leitura (seguro para experimentar)

```json
"--tools=vault,notes,search"
```

Ferramentas disponíveis: list_vaults, set_active_vault, register_vault, list_notes, read_note, search_vault

**Nota:** `create_note`, `update_note` e `delete_note` ficam no grupo `notes`. Para ter apenas leitura verdadeira, você precisaria de um grupo separado (feature futura).

### Produtividade diária

```json
"--tools=vault,notes,search,daily,tags"
```

Ideal para: captura rápida, daily notes, organização por tags.

### Análise de conhecimento

```json
"--tools=vault,notes,search,links,tags"
```

Ideal para: explorar conexões, encontrar notas órfãs, analisar grafo.

### Criação de conteúdo

```json
"--tools=vault,notes,search,templates,frontmatter"
```

Ideal para: criar notas a partir de templates, gerenciar metadados.

## Linha de Comando

```bash
# Ver ajuda completa
yarn start --help

# Iniciar com vault específico
yarn start /caminho/para/vault nome-do-vault

# Iniciar com grupos específicos
yarn start /caminho/para/vault --tools=vault,notes,search

# Usar variável de ambiente
OBSIDIAN_MCP_TOOLS=vault,notes yarn start /caminho/para/vault
```

## Configuração Multi-Vault

Crie o arquivo `~/.obsidian-mcp/config.json`:

```json
{
  "vaults": {
    "personal": "/Users/SEU_USUARIO/Obsidian/Personal",
    "work": "/Users/SEU_USUARIO/Obsidian/Work",
    "research": "/Users/SEU_USUARIO/Obsidian/Research"
  },
  "defaultVault": "personal"
}
```

## Troubleshooting

### O MCP não aparece no Claude Code Desktop

1. Verifique se o caminho do arquivo está correto (use caminho absoluto)
2. Reinicie o Claude Code Desktop completamente
3. Verifique os logs em: `~/Library/Logs/Claude/mcp*.log`

### Erro "Tool X is not enabled"

O tool que você está tentando usar não está habilitado. Verifique sua configuração `--tools` e adicione o grupo necessário.

### Erro de permissão no vault

Verifique se o usuário que executa o Claude Code Desktop tem permissão de leitura/escrita no diretório do vault.

## Desenvolvimento

```bash
# Rodar em modo desenvolvimento
yarn dev

# Build
yarn build

# Type check
yarn tsc --noEmit

# Testes
yarn test
```

## Licença

MIT
