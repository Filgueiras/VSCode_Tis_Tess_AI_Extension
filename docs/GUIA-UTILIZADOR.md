# Guia do Utilizador — Tis.ai para VS Code

> Versão 5.3.0 · Hypercoding Multi-IA

---

## Índice

1. [Primeiros passos](#1-primeiros-passos)
2. [Abrir, fechar e mover o painel](#2-abrir-fechar-e-mover-o-painel)
3. [Interface](#3-interface)
4. [Selecção de provider e modelos](#4-selecção-de-provider-e-modelos)
5. [Conversar com o agente](#5-conversar-com-o-agente)
6. [O que é enviado automaticamente](#6-o-que-é-enviado-automaticamente)
7. [Adicionar contexto de código](#7-adicionar-contexto-de-código)
8. [Auditoria Hypercoding](#8-auditoria-hypercoding)
9. [Medidor de contexto](#9-medidor-de-contexto)
10. [Operações de ficheiros (tool calling)](#10-operações-de-ficheiros-tool-calling)
11. [Guardião de actividade real](#11-guardião-de-actividade-real)
12. [Ressincronização de sessão](#12-ressincronização-de-sessão)
13. [Sessões persistentes e histórico](#13-sessões-persistentes-e-histórico)
14. [Atalhos e menu de contexto](#14-atalhos-e-menu-de-contexto)
15. [Resolução de problemas](#15-resolução-de-problemas)

---

## 1. Primeiros passos

### Instalação

**Via Marketplace:**

`Ctrl+Shift+X` → pesquise **Tis.ai** → **Install**

**Via ficheiro VSIX (instalação manual):**

```
Extensions (Ctrl+Shift+X) → ··· → Install from VSIX… → seleccione o ficheiro .vsix
```

### Configuração

`Ctrl+,` → pesquise `tis` → preencha os campos do(s) provider(s) que vai usar:

**Tess:**

| Definição | O que preencher | Onde obter |
|---|---|---|
| `tis.tessApiKey` | Token de autenticação | [tess.im/dashboard/user/tokens](https://tess.im/dashboard/user/tokens) |
| `tis.tessAgentId` | Número no URL do agente | `tess.im/dashboard/agents/**12345**/edit` |

**TisAI:**

| Definição | O que preencher |
|---|---|
| `tis.tisAiApiKey` | Chave API do painel TisAI (formato `tis_...`) |
| `tis.tisAiAssistantId` | (Opcional) ID do assistente |

**Ollama (local):**

| Definição | O que preencher |
|---|---|
| `tis.ollama.baseUrl` | URL do servidor Ollama (padrão: `http://localhost:11434`) |

**Endpoint remoto:**

| Definição | O que preencher |
|---|---|
| `tis.remote.endpoint` | URL base — ex: `https://meuservidor.com/v1` |
| `tis.remote.apiKey` | (Opcional) Chave API — enviada como `Authorization: Bearer` |
| `tis.remote.model` | (Opcional) Modelo por omissão |

> O endpoint remoto deve suportar `POST /chat/completions` com streaming SSE no formato OpenAI.

### Migração da versão 3.x

| Antes (v3.x) | Agora (v5.x) |
|---|---|
| `tess.apiKey` | `tis.tessApiKey` |
| `tess.agentId` | `tis.tessAgentId` |

---

## 2. Abrir, fechar e mover o painel

- **Mostrar:** clique no ícone TIS na Activity Bar, ou `View → Open View… → Chat Tis.ai`
- **Ocultar:** clique novamente no ícone, ou clique direito → **Hide**
- **Mover:** arraste para qualquer posição na barra lateral ou painel inferior

> Ocultar o painel cancela qualquer resposta em curso. O histórico de mensagens é sempre preservado.

---

## 3. Interface

```
┌─────────────────────────────────────────────────┐
│ Ligação: [Tess ▼]   Modelo: [Auto ▼]            │  ← Toolbar
│                          Histórico    Limpar    │
├─────────────────────────────────────────────────┤
│                                                 │
│  [mensagens do chat]                            │  ← Área de mensagens
│                                                 │
├─────────────────────────────────────────────────┤
│ 📎 Ficheiros  🗂️ Projecto  🔍 Hypercoding  🔄   │  ← Botões de acção
│ ┌───────────────────────────────────────────┐   │
│ │ Escreva aqui...                     [Env] │   │  ← Input
│ └───────────────────────────────────────────┘   │
│ contexto: ~12K / 200K tok  ████░░               │  ← Medidor
└─────────────────────────────────────────────────┘
```

---

## 4. Selecção de provider e modelos

O dropdown **"Ligação:"** alterna entre os quatro providers disponíveis. A lista de modelos actualiza automaticamente ao mudar.

| Provider | Autenticação | Modelos |
|---|---|---|
| **Tess** | `tis.tessApiKey` + `tis.tessAgentId` | Dinâmicos via `GET /agents/{id}` |
| **TisAI** | `tis.tisAiApiKey` | Dinâmicos via API → lista estática |
| **Ollama (local)** | Nenhuma | Modelos instalados via `GET /api/tags` |
| **Remoto** | `tis.remote.apiKey` (opcional) | Via `GET /models` → modelo configurado |

**Notas:**
- Se o selector de modelo Tess aparecer desactivado com "Padrão do agente", o agente tem modelo fixo — comportamento normal
- Ollama mostra placeholder informativo se o servidor não estiver a correr
- Remoto pré-selecciona `tis.remote.model` se a listagem não estiver disponível

---

## 5. Conversar com o agente

- **Enviar:** `Enter` ou clique em **Enviar**
- **Nova linha:** `Shift+Enter`
- **Parar resposta a meio:** clique em **Parar** (botão fica vermelho durante a resposta)

A resposta aparece em streaming. Clique em **Limpar** para começar nova conversa (o histórico anterior é guardado).

---

## 6. O que é enviado automaticamente

### Árvore do projecto (primeira mensagem de cada sessão)

Na primeira mensagem de cada sessão nova, é injectada automaticamente a lista de ficheiros do projecto (até 300), excluindo `node_modules`, `.git`, `dist` e similares.

### Código do editor activo (todas as mensagens)

Em cada mensagem, o conteúdo do ficheiro aberto no editor é incluído automaticamente:

- Com **selecção**: envia apenas a selecção
- Sem selecção: envia o ficheiro completo

---

## 7. Adicionar contexto de código

### 📎 Adicionar ficheiros

Abre um selector de ficheiros do workspace. Os ficheiros escolhidos são injectados como blocos de código na caixa de texto.

### 🗂️ Contexto do projecto

Injeta a árvore de ficheiros completa do workspace no chat. Útil para perguntas de arquitectura ou quando o agente precisa de ver a estrutura antes de agir.

---

## 8. Auditoria Hypercoding

Clique em **🔍 Hypercoding** para analisar o ficheiro activo no editor segundo os cinco princípios do manifesto.

### O que a auditoria examina

| Princípio | O que avalia |
|---|---|
| **1. Qualidade e clareza** | Nomes, duplicação, estrutura, legibilidade |
| **2. Segurança** | Inputs sem validação, credenciais expostas, injecções, dependências vulneráveis |
| **3. Eficiência** | Operações custosas desnecessárias, estruturas inadequadas, desperdício de recursos |
| **4. Manutenibilidade** | Múltiplas responsabilidades, falta de comentários, código morto |
| **5. Autonomia com supervisão** | Decisões com impacto relevante que deviam ser explícitas |

### Prioridade de acção

A auditoria termina sempre com uma lista das **3 coisas mais importantes a corrigir**, por ordem de impacto — sem ambiguidade sobre por onde começar.

### Como usar

1. Abra o ficheiro que quer auditar no editor (ou seleccione uma secção)
2. Clique em **🔍 Hypercoding**
3. A auditoria corre com o provider e modelo seleccionados no dropdown
4. O resultado é guardado no histórico da sessão

> O botão fica inactivo enquanto uma resposta está em curso.

---

## 9. Medidor de contexto

```
████████████░░░░░░░░  ~24K / 200K tok
```

| Cor | Significado |
|---|---|
| Verde | Contexto confortável |
| Amarelo | A aproximar-se do limite — considere focar ou condensar |
| Vermelho | Limite próximo — recomenda-se nova conversa (**Limpar**) |

Usa tokens reais da API quando disponíveis; caso contrário, estimativa por contagem de caracteres.

---

## 10. Operações de ficheiros (tool calling)

O agente pode interagir com ficheiros do projecto de forma autónoma.

### Operações disponíveis

| Operação | Confirmação | Notas |
|---|---|---|
| Ver estrutura / ler ficheiro / listar directoria | Não | |
| Abrir ficheiro no editor | Não | Só abre, não altera |
| Criar ficheiro (`write_file`) | **Sim** | Conteúdo completo |
| Edição cirúrgica (`patch_file`) | **Sim** | Altera apenas o que muda |
| Substituição total (`edit_file`) | **Sim** | Avisa se o conteúdo parece parcial |
| Apagar ficheiro | **Sim** | Irreversível |

### Edição cirúrgica com `patch_file`

O `patch_file` é a forma segura de fazer alterações parciais. Em vez de substituir o ficheiro inteiro, o agente indica exactamente o texto a encontrar e o texto de substituição:

```
SEARCH:
const timeout = 30000;
REPLACE:
const timeout = 60000;
```

Se o texto a substituir não for encontrado no ficheiro, a operação falha com erro descritivo — o ficheiro não é alterado. Podem ser aplicados vários patches ao mesmo ficheiro numa única operação.

### Protecção anti-trecho no `edit_file`

Quando o agente usa `edit_file` mas o novo conteúdo é significativamente menor que o ficheiro original, o diálogo de confirmação mostra um aviso:

> ⚠️ O novo conteúdo (X bytes) é muito menor que o ficheiro original (Y bytes). Isso pode substituir o ficheiro inteiro por um trecho. Usa patch_file para edições cirúrgicas.

Pode cancelar e pedir ao agente para usar `patch_file` em vez disso.

### Abrir ficheiro no editor

O agente pode abrir um ficheiro no editor VS Code sem alterar nada (`open_file`). Útil quando quer ver o ficheiro directamente em vez de ler o conteúdo no chat.

### Fluxo de uma operação de escrita

1. O agente emite a tag (`write_file`, `patch_file` ou `edit_file`)
2. O chat mostra a notificação imediatamente (`🩹 A aplicar patch → src/api.js`)
3. Diálogo modal: **Permitir** ou **Cancelar**
4. Se **Permitir**: a operação executa e o ficheiro abre no editor
5. Se **Cancelar**: o agente é informado e pode continuar

### Log local de acções

Todas as operações são registadas em `.tis-log.md` na raiz do workspace:

```
✅ [2026-04-08 10:12:01] get_file: src/api.js → lido com sucesso
✅ [2026-04-08 10:12:45] patch_file: src/api.js → 2 patch(es) aplicados
❌ [2026-04-08 10:13:10] write_file: src/test.js → Operação cancelada pelo utilizador
```

> Recomendação: adicione `.tis-log.md` ao `.gitignore`.

---

## 11. Guardião de actividade real

O Guardião TIS monitoriza se o agente está efectivamente a executar acções ou apenas a responder verbalmente sem trabalho real.

### Como funciona

Após duas respostas consecutivas do agente **sem nenhuma ferramenta executada**, aparece no chat:

> ⚠️ **Guardião TIS**: O assistente respondeu várias vezes sem executar nenhuma acção real. Se estiver a dizer que está a trabalhar sem usar ferramentas, use 🔄 Log Ressinc para retomar, ou cancele e reenvie o pedido.

### O que fazer ao ver o aviso

| Situação | Acção recomendada |
|---|---|
| O agente está em stall (a repetir "estou a trabalhar") | Clique **Parar** → reenvie o pedido com mais detalhe |
| O agente fez perguntas legítimas sem acções | Responda — o contador reset quando usar ferramentas |
| A conversa parece perdida | Clique **🔄 Log Ressinc** para reinjectar o contexto |

O contador é resetado automaticamente sempre que o agente executa uma ferramenta real, e ao clicar **Limpar**.

---

## 12. Ressincronização de sessão

Quando ocorre perda de sincronia (ligação interrompida, timeout durante tool calls):

| Situação | O que acontece |
|---|---|
| Stream terminou durante tool calls | Aviso ⚠️ imediato no chat |
| Timeout de ferramenta (45s) | Aviso ⚠️ com instrução de recuperação |
| Erro de API durante tool calls | Estado limpo + mensagem de erro descritiva |

### Botão 🔄 Log Ressinc

1. A extensão lê `.tis-log.md`
2. Injeta o log no chat como contexto
3. O agente retoma a partir do ponto de interrupção

---

## 13. Sessões persistentes e histórico

A conversa é guardada automaticamente por workspace. Ao reabrir o VS Code, o histórico e o modelo são restaurados.

Clique em **Histórico** na toolbar para ver as sessões do workspace actual.

| Acção | Comportamento |
|---|---|
| Clique no título | Restaura a sessão |
| ··· → Renomear | Título editável inline — `Enter` confirma, `Escape` cancela |
| ··· → Apagar | Pede confirmação — irreversível |

---

## 14. Atalhos e menu de contexto

### Menu de contexto no editor

Clique direito em qualquer ficheiro ou selecção → **Tis: Chat com Código Actual**

### Atalho de teclado personalizado

`Ctrl+Shift+P` → **Preferences: Open Keyboard Shortcuts** → pesquise `tis`

---

## 15. Resolução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| "API Key ou Agent ID Tess não configurados" | Credenciais Tess em falta | `Ctrl+,` → `tis.tessApiKey` + `tis.tessAgentId` |
| "Chave API TisAI não configurada" | `tis.tisAiApiKey` em falta | `Ctrl+,` → `tis.tisAiApiKey` |
| "Endpoint remoto não configurado" | `tis.remote.endpoint` em falta | `Ctrl+,` → `tis.remote.endpoint` |
| Ollama mostra "não detectado" | Servidor Ollama não está a correr | Inicie o Ollama ou verifique `tis.ollama.baseUrl` |
| Selector de modelo desactivado (Tess) | Agente com modelo fixo | Normal — use o agente tal como está |
| 🔍 Hypercoding não responde | Nenhum ficheiro activo | Abra um ficheiro no editor antes de auditar |
| Resposta parou a meio | Timeout ou erro de rede | Clique **Parar** e tente novamente |
| Aviso ⚠️ de dessincronia | Stream interrompido durante tool calls | Clique **🔄 Log Ressinc** |
| Aviso ⚠️ Guardião TIS | Agente sem acções reais por 2+ respostas | Cancele e reenvie, ou use **🔄 Log Ressinc** |
| `patch_file` falha com "SEARCH não encontrado" | Texto SEARCH difere do ficheiro actual | Peça ao agente para reler o ficheiro e corrigir o patch |
| `edit_file` substituiu ficheiro por trecho | Conteúdo parcial foi aceite no diálogo | Restaure pelo git; use `patch_file` para edições parciais |
| UI bloqueada sem resposta (raro) | Dessincronia não detectada | Watchdog de 45s desbloqueará; use **🔄 Log Ressinc** depois |
| `.tis-log.md` não é criado | Sem workspace aberto | Abra uma pasta no VS Code |
| Painel não aparece | Vista oculta | `View → Open View… → Chat Tis.ai` |
| Token Tess expirado | Token revogado | Novo token em [tess.im/dashboard/user/tokens](https://tess.im/dashboard/user/tokens) → actualizar `tis.tessApiKey` |

---

*TIS Angola · [tis.ao](https://tis.ao)*
