# Sistema de Logging

O servidor MCP do Obsidian possui um sistema de logging robusto que registra eventos, erros e operações importantes.

## Localização dos Logs

Os logs são salvos em dois lugares:

1. **Logs locais do projeto**: `/logs/mcp-server-YYYY-MM-DD.log`
   - Ficam na pasta `logs/` na raiz do projeto
   - Um arquivo novo é criado para cada dia
   - Logs antigos são automaticamente removidos após 7 dias

2. **Logs do sistema Claude**: `/Users/<usuario>/Library/Logs/Claude/mcp-server-obsidian.log`
   - Gerenciados automaticamente pelo Claude Desktop
   - Contém principalmente erros e avisos

## Níveis de Log

O sistema suporta 4 níveis de log:

- `debug`: Informações detalhadas de debug (desabilitado por padrão)
- `info`: Eventos normais do servidor (habilitado por padrão)
- `warn`: Avisos que não impedem o funcionamento
- `error`: Erros que precisam de atenção

## Configuração

Você pode controlar o nível mínimo de log através da variável de ambiente `LOG_LEVEL`:

```bash
# Mostrar apenas erros
LOG_LEVEL=error npx tsx src/index.ts /path/to/vault

# Mostrar tudo incluindo debug
LOG_LEVEL=debug npx tsx src/index.ts /path/to/vault

# Padrão (info)
npx tsx src/index.ts /path/to/vault
```

## O Que É Registrado

O sistema de logging registra:

- **Inicialização do servidor**: Quando o servidor inicia e quais ferramentas estão habilitadas
- **Operações de vault**: Registro, ativação e mudanças de vaults
- **Chamadas de ferramentas**: Todas as ferramentas chamadas e seus argumentos (nível debug)
- **Erros**: Todos os erros com stack traces completos
- **Avisos**: Operações suspeitas ou não ideais

## Formato dos Logs

Cada linha de log contém:

```
[2025-12-28T10:30:45.123Z] INFO  Successfully registered vault: default at /path/to/vault
[2025-12-28T10:30:50.456Z] DEBUG Tool call received: read_note
  Data: {
    "notePath": "example.md"
  }
[2025-12-28T10:31:00.789Z] ERROR Error executing tool read_note
  Error: Note not found
  Stack: Error: Note not found
    at handleReadNote (/path/to/file.ts:123:45)
    ...
```

## Rotação e Limpeza

- **Rotação diária**: Um novo arquivo é criado automaticamente a cada dia
- **Limpeza automática**: Logs com mais de 7 dias são removidos automaticamente
- **Limite de arquivos**: Mantém no máximo 7 arquivos de log

## Usando o Logger no Código

Se você está desenvolvendo novas funcionalidades, pode usar o logger assim:

```typescript
import { logger } from './utils/logger.js';

// Logs simples
logger.info('Operação concluída com sucesso');
logger.warn('Isso pode ser um problema');
logger.error('Algo deu errado');
logger.debug('Informação detalhada de debug');

// Logs com dados adicionais
logger.info('Vault registrado', { name: 'my-vault', path: '/path' });
logger.error('Erro ao processar nota', error);

// Métodos auxiliares
logger.logToolCall('read_note', args, true);
logger.logServerEvent('vault-changed', { oldVault, newVault });
```

## Troubleshooting

### Os logs não estão sendo criados

1. Verifique se a pasta `logs/` existe na raiz do projeto
2. Verifique as permissões de escrita na pasta
3. Verifique o nível de log configurado (pode estar filtrado)

### Os logs estão muito verbosos

Configure o nível mínimo para `warn` ou `error`:

```bash
LOG_LEVEL=warn npx tsx src/index.ts /path/to/vault
```

### Preciso ver logs de debug

Configure o nível para `debug`:

```bash
LOG_LEVEL=debug npx tsx src/index.ts /path/to/vault
```

### Logs ocupando muito espaço

Por padrão, apenas os últimos 7 arquivos são mantidos. Se precisar de menos:

1. Edite `src/utils/logger.ts`
2. Ajuste `maxLogFiles` ou `maxLogAgeDays` no construtor da classe `Logger`

```typescript
export const logger = new Logger({
  minLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
  maxLogFiles: 3,      // Manter apenas 3 arquivos
  maxLogAgeDays: 3,    // Remover logs com mais de 3 dias
});
```
