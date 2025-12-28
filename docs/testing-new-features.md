# Roteiro de Testes - Novas Funcionalidades

> **NOTA**: Este arquivo contém testes para funcionalidades recém-implementadas.
> No futuro, estes testes devem ser integrados aos arquivos de teste existentes.

---

## 1. Replace Mode no update_note

<!-- TESTE NOVO: No futuro deveria ir para testing-notes.md -->

### 1.1 Replace simples (primeira ocorrência)
```
Ferramenta: update_note
Parâmetros:
{
  "path": "test-replace.md",
  "content": "NOVO TEXTO",
  "mode": "replace",
  "search": "texto antigo"
}

Esperado: Substituir apenas a primeira ocorrência de "texto antigo" por "NOVO TEXTO"
Verificar: replacements = 1
```

### 1.2 Replace All (todas as ocorrências)
```
Ferramenta: update_note
Parâmetros:
{
  "path": "test-replace.md",
  "content": "SUBSTITUIDO",
  "mode": "replace",
  "search": "palavra",
  "replaceAll": true
}

Esperado: Substituir TODAS as ocorrências de "palavra"
Verificar: replacements = número de ocorrências
```

### 1.3 Replace com Regex
```
Ferramenta: update_note
Parâmetros:
{
  "path": "test-replace.md",
  "content": "DATA: $1/$2/$3",
  "mode": "replace",
  "search": "(\\d{2})-(\\d{2})-(\\d{4})",
  "useRegex": true,
  "replaceAll": true
}

Esperado: Transformar datas de formato DD-MM-YYYY para DATA: DD/MM/YYYY
```

### 1.4 Replace sem match
```
Ferramenta: update_note
Parâmetros:
{
  "path": "test-replace.md",
  "content": "novo",
  "mode": "replace",
  "search": "texto inexistente"
}

Esperado: replacements = 0, arquivo inalterado
```

### 1.5 Replace mode sem parâmetro search (erro)
```
Ferramenta: update_note
Parâmetros:
{
  "path": "test-replace.md",
  "content": "novo",
  "mode": "replace"
}

Esperado: Erro - "search" parameter is required
```

---

## 2. Proteção de Conflito de Frontmatter (Prepend)

<!-- TESTE NOVO: No futuro deveria ir para testing-notes.md -->

### 2.1 Prepend com conteúdo que inicia com "---"
```
Ferramenta: update_note
Parâmetros:
{
  "path": "note-with-frontmatter.md",
  "content": "---\ntitle: New\n---\nConteúdo",
  "mode": "prepend"
}

Esperado: Erro - FrontmatterConflictError
Mensagem: "Cannot prepend content starting with '---'"
```

### 2.2 Prepend forçado com ignoreFrontmatterConflict
```
Ferramenta: update_note
Parâmetros:
{
  "path": "note-with-frontmatter.md",
  "content": "---\ntitle: New\n---\nConteúdo",
  "mode": "prepend",
  "ignoreFrontmatterConflict": true
}

Esperado: Sucesso - conteúdo adicionado mesmo com "---"
```

### 2.3 Prepend normal (sem "---")
```
Ferramenta: update_note
Parâmetros:
{
  "path": "note-with-frontmatter.md",
  "content": "Novo parágrafo no início\n\n",
  "mode": "prepend"
}

Esperado: Sucesso - conteúdo adicionado após frontmatter
```

---

## 3. rename_note

<!-- TESTE NOVO: No futuro deveria ir para testing-notes.md -->

### 3.1 Renomear nota simples
```
Ferramenta: rename_note
Parâmetros:
{
  "oldPath": "Original.md",
  "newPath": "Renamed.md"
}

Esperado:
- Arquivo renomeado
- linksUpdated >= 0
```

### 3.2 Renomear para outra pasta
```
Ferramenta: rename_note
Parâmetros:
{
  "oldPath": "Note.md",
  "newPath": "Archive/Note.md"
}

Esperado: Nota movida para pasta Archive
```

### 3.3 Renomear com atualização de links
```
Preparação: Criar nota "Target.md" e outra nota com [[Target]] link

Ferramenta: rename_note
Parâmetros:
{
  "oldPath": "Target.md",
  "newPath": "NewTarget.md",
  "updateLinks": true
}

Esperado:
- linksUpdated >= 1
- Links [[Target]] alterados para [[NewTarget]]
```

### 3.4 Renomear sem atualização de links
```
Ferramenta: rename_note
Parâmetros:
{
  "oldPath": "Target.md",
  "newPath": "NewTarget.md",
  "updateLinks": false
}

Esperado: linksUpdated = 0, links não alterados
```

### 3.5 Renomear nota inexistente (erro)
```
Ferramenta: rename_note
Parâmetros:
{
  "oldPath": "NaoExiste.md",
  "newPath": "Novo.md"
}

Esperado: Erro - NoteNotFoundError
```

### 3.6 Renomear para caminho já existente (erro)
```
Ferramenta: rename_note
Parâmetros:
{
  "oldPath": "Note1.md",
  "newPath": "Note2.md"  // já existe
}

Esperado: Erro - NoteAlreadyExistsError
```

---

## 4. move_note

<!-- TESTE NOVO: No futuro deveria ir para testing-notes.md -->

### 4.1 Mover para pasta existente
```
Ferramenta: move_note
Parâmetros:
{
  "path": "Inbox/Note.md",
  "destinationFolder": "Projects"
}

Esperado:
- newPath: "Projects/Note.md"
- linksUpdated >= 0
```

### 4.2 Mover para raiz do vault
```
Ferramenta: move_note
Parâmetros:
{
  "path": "Folder/Note.md",
  "destinationFolder": ""
}

Esperado: newPath: "Note.md"
```

### 4.3 Mover para pasta nova (criada automaticamente)
```
Ferramenta: move_note
Parâmetros:
{
  "path": "Note.md",
  "destinationFolder": "New/Nested/Folder"
}

Esperado:
- Pasta criada
- newPath: "New/Nested/Folder/Note.md"
```

### 4.4 Mover com atualização de links
```
Ferramenta: move_note
Parâmetros:
{
  "path": "Source.md",
  "destinationFolder": "Archive",
  "updateLinks": true
}

Esperado: Links atualizados em outras notas
```

---

## 5. Busca Avançada (Regex e Contexto)

<!-- TESTE NOVO: No futuro deveria ir para testing-search.md -->

### 5.1 Busca com regex simples
```
Ferramenta: search_vault
Parâmetros:
{
  "query": "\\d{4}-\\d{2}-\\d{2}",
  "useRegex": true
}

Esperado: Encontrar todas as datas no formato YYYY-MM-DD
```

### 5.2 Busca com regex e case sensitive
```
Ferramenta: search_vault
Parâmetros:
{
  "query": "TODO|FIXME|HACK",
  "useRegex": true,
  "caseSensitive": true
}

Esperado: Encontrar apenas em MAIÚSCULAS
```

### 5.3 Busca com linhas de contexto
```
Ferramenta: search_vault
Parâmetros:
{
  "query": "importante",
  "contextLines": 2
}

Esperado:
- Cada match inclui contextBefore e contextAfter
- Até 2 linhas antes e depois
```

### 5.4 Regex inválido (erro)
```
Ferramenta: search_vault
Parâmetros:
{
  "query": "[invalid(regex",
  "useRegex": true
}

Esperado: Erro - Invalid regex pattern
```

---

## 6. Gerenciamento Avançado de Frontmatter

<!-- TESTE NOVO: No futuro deveria ir para testing-frontmatter.md -->

### 6.1 remove_frontmatter_field
```
Ferramenta: remove_frontmatter_field
Parâmetros:
{
  "path": "note.md",
  "field": "draft"
}

Esperado:
- Campo "draft" removido
- removed: true (se existia) ou false (se não existia)
```

### 6.2 add_to_array_field - adicionar tags
```
Ferramenta: add_to_array_field
Parâmetros:
{
  "path": "note.md",
  "field": "tags",
  "values": ["nova-tag", "outra-tag"]
}

Esperado:
- Tags adicionadas ao array
- Duplicatas ignoradas
- added: ["nova-tag", "outra-tag"]
```

### 6.3 add_to_array_field - criar campo novo
```
Ferramenta: add_to_array_field
Parâmetros:
{
  "path": "note.md",
  "field": "aliases",
  "values": ["alias1"],
  "createIfMissing": true
}

Esperado: Campo "aliases" criado com valor ["alias1"]
```

### 6.4 add_to_array_field - campo não existe, createIfMissing=false
```
Ferramenta: add_to_array_field
Parâmetros:
{
  "path": "note.md",
  "field": "naoexiste",
  "values": ["valor"],
  "createIfMissing": false
}

Esperado: Erro - Field does not exist
```

### 6.5 add_to_array_field - campo não é array (erro)
```
Preparação: Nota com frontmatter { title: "string" }

Ferramenta: add_to_array_field
Parâmetros:
{
  "path": "note.md",
  "field": "title",
  "values": ["novo"]
}

Esperado: Erro - Field is not an array
```

### 6.6 remove_from_array_field
```
Ferramenta: remove_from_array_field
Parâmetros:
{
  "path": "note.md",
  "field": "tags",
  "values": ["tag-remover"]
}

Esperado:
- Tag removida do array
- removed: ["tag-remover"]
```

---

## 7. Opções Avançadas de list_notes

<!-- TESTE NOVO: No futuro deveria ir para testing-notes.md -->

### 7.1 Ordenar por nome
```
Ferramenta: list_notes
Parâmetros:
{
  "sortBy": "name",
  "sortOrder": "asc"
}

Esperado: Notas ordenadas alfabeticamente A-Z
```

### 7.2 Ordenar por data de criação
```
Ferramenta: list_notes
Parâmetros:
{
  "sortBy": "created",
  "sortOrder": "desc"
}

Esperado: Notas mais recentes primeiro
```

### 7.3 Paginação
```
Ferramenta: list_notes
Parâmetros:
{
  "limit": 10,
  "offset": 0
}

Esperado:
- Máximo 10 notas retornadas
- hasMore: true (se houver mais)
- total: número total de notas
```

### 7.4 Segunda página
```
Ferramenta: list_notes
Parâmetros:
{
  "limit": 10,
  "offset": 10
}

Esperado: Próximas 10 notas
```

### 7.5 Filtro por padrão de nome (regex)
```
Ferramenta: list_notes
Parâmetros:
{
  "namePattern": "^2024"
}

Esperado: Apenas notas que começam com "2024"
```

### 7.6 Filtro por padrão - regex inválido
```
Ferramenta: list_notes
Parâmetros:
{
  "namePattern": "[invalid"
}

Esperado: Erro - Invalid name pattern regex
```

### 7.7 Combinação de filtros
```
Ferramenta: list_notes
Parâmetros:
{
  "folder": "Projects",
  "sortBy": "modified",
  "sortOrder": "desc",
  "limit": 5,
  "namePattern": ".*-draft$"
}

Esperado: 5 notas mais recentes de Projects que terminam com "-draft"
```

---

## 8. Operações em Lote (Batch)

<!-- TESTE NOVO: No futuro deveria ir para um novo arquivo testing-batch.md -->

### 8.1 batch_move
```
Ferramenta: batch_move
Parâmetros:
{
  "paths": ["Note1.md", "Note2.md", "Note3.md"],
  "destinationFolder": "Archive"
}

Esperado:
- total: 3
- succeeded: 3 (ou menos se algum falhar)
- results: array com status de cada nota
```

### 8.2 batch_move com erro parcial
```
Ferramenta: batch_move
Parâmetros:
{
  "paths": ["Existe.md", "NaoExiste.md"],
  "destinationFolder": "Folder"
}

Esperado:
- succeeded: 1
- failed: 1
- results[1].error definido
```

### 8.3 batch_delete sem confirmação (erro)
```
Ferramenta: batch_delete
Parâmetros:
{
  "paths": ["Note1.md", "Note2.md"],
  "confirm": false
}

Esperado: Erro - Confirmation required
```

### 8.4 batch_delete com confirmação
```
Ferramenta: batch_delete
Parâmetros:
{
  "paths": ["ToDelete1.md", "ToDelete2.md"],
  "confirm": true
}

Esperado:
- Notas deletadas
- succeeded = número de notas deletadas
```

### 8.5 batch_update_frontmatter
```
Ferramenta: batch_update_frontmatter
Parâmetros:
{
  "paths": ["Note1.md", "Note2.md"],
  "updates": {
    "status": "reviewed",
    "reviewed_date": "2024-01-15"
  }
}

Esperado: Frontmatter atualizado em todas as notas
```

### 8.6 batch_update_frontmatter com replace
```
Ferramenta: batch_update_frontmatter
Parâmetros:
{
  "paths": ["Note1.md"],
  "updates": { "only": "this" },
  "replace": true
}

Esperado: Todo frontmatter substituído (não merge)
```

### 8.7 batch_add_tag
```
Ferramenta: batch_add_tag
Parâmetros:
{
  "paths": ["Note1.md", "Note2.md", "Note3.md"],
  "tags": ["project-x", "2024"]
}

Esperado:
- Tags adicionadas a todas as notas
- results[n].details.addedTags mostra tags novas
```

### 8.8 batch_remove_tag
```
Ferramenta: batch_remove_tag
Parâmetros:
{
  "paths": ["Note1.md", "Note2.md"],
  "tags": ["obsolete", "draft"]
}

Esperado: Tags removidas de todas as notas
```

---

## 9. Gerenciamento de Anexos

<!-- TESTE NOVO: No futuro deveria ir para um novo arquivo testing-attachments.md -->

### 9.1 list_attachments
```
Ferramenta: list_attachments
Parâmetros: {}

Esperado:
- Lista de todos os anexos (imagens, PDFs, etc)
- path, name, extension, size para cada
```

### 9.2 list_attachments com filtro de extensão
```
Ferramenta: list_attachments
Parâmetros:
{
  "extensions": ["png", "jpg", "jpeg"]
}

Esperado: Apenas imagens listadas
```

### 9.3 list_attachments em pasta específica
```
Ferramenta: list_attachments
Parâmetros:
{
  "folder": "attachments"
}

Esperado: Apenas anexos da pasta especificada
```

### 9.4 get_attachment_info
```
Ferramenta: get_attachment_info
Parâmetros:
{
  "path": "attachments/image.png"
}

Esperado:
- path, name, extension
- size (bytes)
- modified date
```

### 9.5 find_unused_attachments
```
Ferramenta: find_unused_attachments
Parâmetros: {}

Esperado:
- Lista de anexos não referenciados em nenhuma nota
- Útil para limpeza do vault
```

### 9.6 find_unused_attachments com extensões
```
Ferramenta: find_unused_attachments
Parâmetros:
{
  "extensions": ["pdf"]
}

Esperado: Apenas PDFs não utilizados
```

### 9.7 get_attachments_in_note
```
Ferramenta: get_attachments_in_note
Parâmetros:
{
  "path": "note-with-images.md"
}

Esperado:
- Lista de anexos referenciados na nota
- Formato: ![[image.png]] ou ![](path/to/image.png)
```

---

## 10. Sistema de Backup

<!-- TESTE NOVO: No futuro deveria ir para um novo arquivo testing-backup.md -->

### 10.1 create_note_backup
```
Ferramenta: create_note_backup
Parâmetros:
{
  "path": "important-note.md"
}

Esperado:
- Backup criado em .backups/
- backupPath retornado
- Nome inclui timestamp
```

### 10.2 list_backups
```
Ferramenta: list_backups
Parâmetros:
{
  "path": "important-note.md"
}

Esperado:
- Lista de backups existentes
- Ordenados por data (mais recente primeiro)
- timestamp e backupPath para cada
```

### 10.3 list_backups - nota sem backups
```
Ferramenta: list_backups
Parâmetros:
{
  "path": "note-sem-backup.md"
}

Esperado: backups: [] (array vazio)
```

### 10.4 restore_backup
```
Preparação: Criar backup, modificar nota original

Ferramenta: restore_backup
Parâmetros:
{
  "path": "important-note.md",
  "backupPath": ".backups/important-note.2024-01-15T10-30-00.md"
}

Esperado:
- Nota restaurada para versão do backup
- restored: true
```

### 10.5 restore_backup - backup inexistente (erro)
```
Ferramenta: restore_backup
Parâmetros:
{
  "path": "note.md",
  "backupPath": ".backups/inexistente.md"
}

Esperado: Erro - Backup not found
```

### 10.6 delete_old_backups
```
Ferramenta: delete_old_backups
Parâmetros:
{
  "path": "important-note.md",
  "keepCount": 3
}

Esperado:
- Mantém apenas os 3 backups mais recentes
- deleted: número de backups removidos
- remaining: 3
```

### 10.7 delete_old_backups - manter todos
```
Ferramenta: delete_old_backups
Parâmetros:
{
  "path": "note.md",
  "keepCount": 100
}

Esperado: deleted: 0 (nenhum removido se há menos de 100)
```

---

## Notas de Integração Futura

Quando reorganizar os testes:

1. **testing-notes.md** deve receber:
   - Seção 1 (Replace Mode)
   - Seção 2 (Frontmatter Conflict)
   - Seção 3 (rename_note)
   - Seção 4 (move_note)
   - Seção 7 (list_notes avançado)

2. **testing-search.md** deve receber:
   - Seção 5 (Regex e Contexto)

3. **testing-frontmatter.md** deve receber:
   - Seção 6 (remove/add/remove array fields)

4. **Criar testing-batch.md** com:
   - Seção 8 (Batch Operations)

5. **Criar testing-attachments.md** com:
   - Seção 9 (Attachment Management)

6. **Criar testing-backup.md** com:
   - Seção 10 (Backup System)
