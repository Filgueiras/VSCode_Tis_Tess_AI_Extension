# Guia do Utilizador — Tess Tis para VS Code

> Versão 3.1.x

---

## Índice

1. [Primeiros passos](#1-primeiros-passos)
2. [Abrir, fechar e mover o painel](#2-abrir-fechar-e-mover-o-painel)
3. [Interface](#3-interface)
4. [Conversar com o agente](#4-conversar-com-o-agente)
5. [O que é enviado automaticamente](#5-o-que-é-enviado-automaticamente)
6. [Adicionar contexto de código](#6-adicionar-contexto-de-código)
7. [Medidor de contexto](#7-medidor-de-contexto)
8. [Operações de ficheiros (tool calling)](#8-operações-de-ficheiros-tool-calling)
9. [Ressincronização de sessão](#9-ressincronização-de-sessão)
10. [Sessões persistentes e histórico](#10-sessões-persistentes-e-histórico)
11. [Escolha de modelo](#11-escolha-de-modelo)
12. [Atalhos e menu de contexto](#12-atalhos-e-menu-de-contexto)
13. [Resolução de problemas](#13-resolução-de-problemas)

---

## 1. Primeiros passos

### Instalação

**Via Marketplace:**

1. `Ctrl+Shift+X` → pesquise **Tess Tis** → **Install**

**Via ficheiro VSIX (instalação manual):**

```
Extensions (Ctrl+Shift+X) → ··· → Install from VSIX… → seleccione o ficheiro .vsix
```

### Configuração obrigatória

Antes de usar, a extensão precisa de dois valores: uma **API Key** e um **Agent ID**.

`Ctrl+,` → pesquise `tess` → preencha:

| Definição | O que preencher | Onde obter |
|---|---|---|
| `tess.apiKey` | Token de autenticação | [tess.im/dashboard/user/tokens](https://tess.im/dashboard/user/tokens) — crie um token e copie-o (mostrado uma única vez) |
| `tess.agentId` | Número do URL do agente | `tess.im/dashboard/agents/**12345**/edit` — o número no URL |

As definições têm âmbito **global** — configura uma vez, funcionam em todos os workspaces. Após guardar, a extensão detecta a alteração e activa o painel automaticamente, sem necessidade de recarregar o VS Code.

---

## 2. Abrir, fechar e mover o painel

### Mostrar o painel

- Clique no ícone da Tess na **Activity Bar** (barra vertical à esquerda)
- Ou: **View → Open View… → Tess Chat**

### Ocultar o painel

- Clique novamente no ícone da Tess na Activity Bar
- Ou: clique direito no ícone → **Hide**

### Mover o painel

O painel pode ser arrastado para qualquer posição na barra lateral, ou movido para o painel inferior (`View → Appearance → Panel`), como qualquer outra vista do VS Code.

> **Nota:** ao ocultar e mostrar o painel, qualquer resposta em curso é cancelada automaticamente. O estado da conversa (histórico de mensagens) é sempre preservado.

---

## 3. Interface

```
┌─────────────────────────────────────┐
│ Modelo: [Auto ▼]  Histórico  Limpar │  ← Toolbar
├─────────────────────────────────────┤
│                                     │
│  [mensagens do chat]                │  ← Área de mensagens
│                                     │
├─────────────────────────────────────┤
│ 📎 Ficheiros  🗂️ Projecto  🔄 Ressinc│  ← Botões de acção
│ ┌─────────────────────────────┐     │
│ │ Escreva aqui...             │[Env]│  ← Input
│ └─────────────────────────────┘     │
│ contexto: ~12K / 200K tok  ████░░   │  ← Medidor de contexto
└─────────────────────────────────────┘
```

---

## 4. Conversar com o agente

- **Enviar:** `Enter` ou clique em **Enviar**
- **Nova linha:** `Shift+Enter`
- **Parar resposta a meio:** clique em **Parar** (o botão muda de cor durante a resposta)

A resposta aparece em streaming — letra a letra, em tempo real. Clique em **Limpar** na toolbar para começar uma nova conversa (o histórico da sessão anterior é guardado automaticamente — ver secção 10).

---

## 5. O que é enviado automaticamente

A extensão enriquece cada mensagem com contexto do projecto, de forma silenciosa.

### Árvore do projecto (primeira mensagem de cada sessão)

Na **primeira mensagem** de cada sessão nova, é injectada automaticamente a lista de todos os ficheiros do projecto (até 300), excluindo pastas como `node_modules`, `.git` e `dist`.

O agente fica a conhecer a estrutura do projecto sem que precise de a descrever. Pode também enviar a árvore manualmente a qualquer momento através do botão **🗂️ Contexto do projecto**.

### Código do editor activo (todas as mensagens)

Em **cada mensagem**, o conteúdo do ficheiro aberto no editor é incluído automaticamente no contexto, formatado como bloco de código com a linguagem identificada.

- Se tiver **texto seleccionado**, apenas a selecção é enviada
- Se não houver selecção, o ficheiro completo é enviado

Isto significa que pode perguntar directamente "o que faz esta função?" sem precisar de copiar código para o chat.

---

## 6. Adicionar contexto de código

### 📎 Adicionar ficheiros

Abre um selector de ficheiros do workspace. Os ficheiros escolhidos são injectados como blocos de código na caixa de texto, prontos para editar antes de enviar.

**Quando usar:** ficheiros fechados no editor, ficheiros de configuração (`docker-compose.yml`, `.env.example`), comparação de dois ficheiros num único pedido.

### 🗂️ Contexto do projecto

Injeta a árvore de ficheiros completa do workspace no chat. Útil quando quer que o agente conheça a estrutura do projecto antes de fazer perguntas de arquitectura.

> **Diferença do contexto automático:** o contexto automático envia a lista de ficheiros (primeira mensagem) e o ficheiro activo (todas as mensagens). Os botões manuais enviam conteúdo de ficheiros à sua escolha.

---

## 7. Medidor de contexto

Na base do painel existe uma barra de progresso que mostra o contexto consumido:

```
████████████░░░░░░░░  ~24K / 200K tok
```

| Cor | Significado |
|---|---|
| **Verde** | Contexto confortável, pode continuar normalmente |
| **Amarelo** | A aproximar-se do limite — considere condensar ou focar no essencial |
| **Vermelho** | Limite próximo — recomenda-se começar uma nova conversa (**Limpar**) |

O valor exibido é uma estimativa baseada no histórico e nos ficheiros incluídos. Quando disponível, usa os tokens reais reportados pela API.

---

## 8. Operações de ficheiros (tool calling)

O agente pode interagir com os ficheiros do projecto de forma autónoma. Cada operação de escrita requer confirmação explícita.

### Operações disponíveis

| Operação | O que faz | Requer confirmação |
|---|---|---|
| Ver estrutura | Mostra a árvore completa do projecto | Não |
| Ler ficheiro | Lê o conteúdo de um ficheiro para análise | Não |
| Listar directoria | Mostra o conteúdo de uma pasta | Não |
| Criar ficheiro | Cria um ficheiro novo com o conteúdo gerado | **Sim** |
| Editar ficheiro | Substitui o conteúdo de um ficheiro existente | **Sim** |

### Fluxo de uma operação

1. O agente decide que precisa de executar uma operação
2. O chat mostra **imediatamente** o tipo e o caminho — por exemplo:
   - `📖 A ler ficheiro → src/api.js`
   - `✏️ A editar ficheiro → src/provider.js`
3. Para operações de escrita, um diálogo modal pede confirmação: **"Tess quer editar: src/provider.js"**
4. Se clicar **Permitir**, a operação executa e o ficheiro abre no editor
5. Se clicar **Cancelar**, a operação é abortada e o agente é informado
6. Quando **todas** as operações do lote terminam, o agente recebe os resultados e continua

> As notificações de ferramenta persistem no chat como histórico visual das operações — não desaparecem.

### Múltiplas operações em sequência

Quando o agente precisa de executar várias operações (por exemplo: ler três ficheiros antes de os editar), todas são executadas antes de a conversa prosseguir. O utilizador vê cada notificação aparecer à medida que a operação começa, e o agente recebe todos os resultados de uma vez antes de responder.

### Log local de acções

Todas as operações são registadas automaticamente em `.tess-log.md` na raiz do workspace:

```
# Tess — Log de Acções

✅ [2026-04-04 15:32:01] get_file: src/api.js → lido com sucesso
✅ [2026-04-04 15:32:45] edit_file: src/api.js → Ficheiro editado com sucesso: src/api.js
❌ [2026-04-04 15:33:10] write_file: src/test.js → Operação cancelada pelo utilizador
```

O log é cumulativo — acumula acções de todas as sessões. Pode apagá-lo manualmente quando quiser recomeçar o registo.

> **Recomendação:** adicione `.tess-log.md` ao `.gitignore` se não quiser versionar o log de sessão.

---

## 9. Ressincronização de sessão

Quando o agente executa várias operações e algo corre mal (ligação interrompida, timeout, webview recriado), pode ocorrer perda de sincronia.

### Detecção automática

A extensão detecta automaticamente três situações de dessincronia:

| Situação | O que acontece |
|---|---|
| Stream terminou durante execução de ferramentas | Aviso ⚠️ imediato no chat |
| Tempo esgotado a aguardar resultado de ferramenta (45s) | Aviso ⚠️ com instrução de recuperação |
| Erro de API durante tool calls | Estado limpo + mensagem de erro descritiva |

Em qualquer destes casos, a UI é desbloqueada automaticamente e aparece uma mensagem com instrução:

> ⚠️ A conversa perdeu sincronia (stream terminou durante execução de ferramentas). Use "🔄 Log Ressinc" para retomar.

### Botão 🔄 Log Ressinc

Disponível sempre nos botões de acção. Ao clicar:

1. A extensão lê `.tess-log.md`
2. Injeta o log no chat como mensagem de contexto
3. O agente analisa o que já foi feito e informa o que falta concluir

Use este botão sempre que o agente "perdeu o fio" durante uma tarefa com múltiplas operações de ficheiros, mesmo que não tenha aparecido aviso automático.

> Se `.tess-log.md` não existir, é mostrado um erro: execute algumas operações de ficheiros primeiro para que o log seja criado.

---

## 10. Sessões persistentes e histórico

### Persistência automática

A conversa é guardada automaticamente por projecto (workspace). Ao fechar e reabrir o VS Code:

- O histórico de mensagens é restaurado
- O modelo seleccionado é mantido
- O medidor de contexto reflecte o estado anterior

Cada workspace tem a sua própria sessão independente — abrir um projecto diferente retoma a conversa desse projecto, sem misturar contexto. As credenciais (`tess.apiKey` e `tess.agentId`) são globais e partilhadas.

### Histórico de conversas

Clique em **Histórico** na toolbar para abrir o drawer de sessões do workspace actual.

- Cada sessão é nomeada automaticamente com base na primeira mensagem
- Clique no título de uma sessão para a restaurar
- Clique em **···** para aceder às opções:

| Acção | Comportamento |
|---|---|
| **Renomear** | O título torna-se editável inline — confirme com `Enter` ou cancele com `Escape` |
| **Apagar** | Pede confirmação antes de apagar — a acção é irreversível |

O histórico mostra apenas as conversas do projecto aberto.

---

## 11. Escolha de modelo

O selector de modelo na toolbar permite escolher o modelo para a próxima mensagem.

| Modelo | Melhor para |
|---|---|
| **Auto** | Deixar o agente Tess decidir o mais adequado |
| **Tess 5** | Tarefas gerais, mais económico |
| **Claude Opus 4.6** | Raciocínio complexo, arquitectura, revisão profunda |
| **Claude Sonnet 4.6** | Equilíbrio entre qualidade e velocidade |
| **Claude Haiku 4.5** | Respostas rápidas, tarefas simples |
| **GPT-4o / GPT-4.1** | Alternativa OpenAI |
| **Gemini 2.5 Pro** | Contextos muito longos |
| **Gemini 2.0 Flash** | Velocidade máxima |

> Se o selector aparecer desactivado, o agente tem um modelo fixo configurado — a escolha de modelo não é exposta.

---

## 12. Atalhos e menu de contexto

### Menu de contexto no editor

Clique direito em qualquer ficheiro ou selecção de código → **Tis: Chat com Código Actual**

- Se tiver texto seleccionado, apenas a selecção é incluída no contexto
- Se não houver selecção, o ficheiro completo é usado
- O painel da Tess abre automaticamente se estiver fechado

### Atalho de teclado

Pode configurar um atalho personalizado para abrir o painel:

`Ctrl+Shift+P` → **Preferences: Open Keyboard Shortcuts** → pesquise `tess`

---

## 13. Resolução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| Painel bloqueado com aviso de configuração | `tess.apiKey` ou `tess.agentId` não preenchidos | `Ctrl+,` → pesquise `tess` → preencha ambos |
| Selector de modelo desactivado | Agente com modelo fixo | Normal — use o agente tal como está |
| Resposta parou a meio | Timeout ou erro de rede | Clique **Parar** e tente novamente |
| Aviso ⚠️ de dessincronia no chat | Stream interrompido durante tool calls | Clique **🔄 Log Ressinc** para retomar |
| UI bloqueada sem resposta (raro) | Dessincronia não detectada | O watchdog de 45s desbloqueará automaticamente; use **🔄 Log Ressinc** depois |
| Agente responde sem conhecer o projecto | Primeira mensagem da sessão | Normal — o contexto é enviado com a primeira mensagem; o agente estará informado a partir daí |
| `.tess-log.md` não é criado | Sem workspace aberto ou sem operações de ficheiros executadas | Abra uma pasta no VS Code e execute uma operação de ficheiro |
| Diálogo de confirmação não aparece | Operação de leitura (não requer confirmação) | Normal — apenas criação/edição de ficheiros pede confirmação |
| Painel não aparece na barra lateral | Vista oculta | **View → Open View… → Tess Chat** |
| Token expirado / "API Key inválida" | Token revogado em tess.im | Crie um novo token em [tess.im/dashboard/user/tokens](https://tess.im/dashboard/user/tokens) e actualize `tess.apiKey` |

---

*Tis Angola · [tis.ao](https://tis.ao)*
