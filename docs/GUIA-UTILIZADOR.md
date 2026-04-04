# Guia do Utilizador — Tess Tis para VS Code

> Versão 3.1.0

---

## Índice

1. [Primeiros passos](#1-primeiros-passos)
2. [Interface](#2-interface)
3. [Conversar com o agente](#3-conversar-com-o-agente)
4. [Adicionar contexto de código](#4-adicionar-contexto-de-código)
5. [Operações de ficheiros (tool calling)](#5-operações-de-ficheiros-tool-calling)
6. [Ressincronização de sessão](#6-ressincronização-de-sessão)
7. [Histórico de conversas](#7-histórico-de-conversas)
8. [Escolha de modelo](#8-escolha-de-modelo)
9. [Resolução de problemas](#9-resolução-de-problemas)

---

## 1. Primeiros passos

### Instalação

1. `Ctrl+Shift+X` → pesquise **Tess Tis** → **Install**
2. O painel **Tess Chat** aparece na barra lateral

### Configuração obrigatória

`Ctrl+,` → pesquise `tess` → preencha:

| Definição | Onde obter |
|---|---|
| `tess.apiKey` | [tess.im/dashboard/user/tokens](https://tess.im/dashboard/user/tokens) |
| `tess.agentId` | Número no URL do agente: `tess.im/dashboard/agents/**12345**/edit` |

As definições são globais — configura uma vez, funcionam em todos os workspaces.

---

## 2. Interface

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
│ │ Escreve aqui...             │[Env]│  ← Input
│ └─────────────────────────────┘     │
│ contexto: 0 tok  ████░░░░░░         │  ← Medidor de contexto
└─────────────────────────────────────┘
```

---

## 3. Conversar com o agente

- **Enviar:** `Enter` ou clique em **Enviar**
- **Nova linha:** `Shift+Enter`
- **Parar resposta a meio:** clique em **Parar** (o botão Enviar muda de cor durante a resposta)

O ficheiro activo no editor é incluído automaticamente em cada mensagem. Se tiver texto seleccionado, apenas a selecção é incluída.

---

## 4. Adicionar contexto de código

### 📎 Adicionar ficheiros

Abre um selector de ficheiros do workspace. Os ficheiros escolhidos são injectados como blocos de código na caixa de texto — pode editá-los antes de enviar.

### 🗂️ Contexto do projecto

Injeta a árvore de ficheiros completa do workspace no chat. Útil quando quer que o agente conheça a estrutura do projecto antes de fazer perguntas de arquitectura.

### Menu de contexto no editor

Clique direito em qualquer ficheiro ou selecção → **Tis: Chat com Código Actual**

---

## 5. Operações de ficheiros (tool calling)

O agente pode interagir com os ficheiros do projecto de forma autónoma. Cada operação requer confirmação explícita.

### Operações disponíveis

| Operação | O que faz |
|---|---|
| Ler ficheiro | Lê o conteúdo de um ficheiro para análise |
| Listar directoria | Mostra o conteúdo de uma pasta |
| Ver estrutura | Mostra a árvore completa do projecto |
| Criar ficheiro | Cria um ficheiro novo com o conteúdo gerado pelo agente |
| Editar ficheiro | Substitui o conteúdo de um ficheiro existente |

### Fluxo de uma operação

1. O agente decide que precisa de executar uma operação
2. O chat mostra o tipo e o caminho: `✏️ Editando ficheiro: src/api.js`
3. Um diálogo modal pede confirmação: **"Tess quer editar: src/api.js"**
4. Se clicar **Permitir**, a operação executa e o ficheiro abre no editor
5. Se clicar **Cancelar**, a operação é abortada e o agente é informado
6. O agente recebe o resultado e continua a resposta

### Log local de acções

Todas as operações são registadas automaticamente em `.tess-log.md` na raiz do workspace:

```
# Tess — Log de Acções

✅ [2026-04-04 15:32:01] get_file: src/api.js → lido com sucesso
✅ [2026-04-04 15:32:45] edit_file: src/api.js → Ficheiro editado com sucesso: src/api.js
❌ [2026-04-04 15:33:10] write_file: src/test.js → Operação cancelada pelo utilizador
```

O log é cumulativo — acumula acções de todas as sessões. Pode apagá-lo manualmente quando quiser recomeçar o registo.

> **Nota:** considere adicionar `.tess-log.md` ao `.gitignore` se não quiser versionar o log de sessão.

---

## 6. Ressincronização de sessão

Quando o agente executa várias operações em sequência, pode ocorrer perda de sincronia — por exemplo, se a ligação cair a meio, se o agente for interrompido, ou se o contexto da conversa for perdido.

### Deteção automática

Se o chat detectar que havia operações em curso quando ocorreu um erro, aparece automaticamente um aviso:

> ⚠️ Perda de sincronia detectada — algumas acções podem não ter completado. [Ressincronizar agora?]

Clique em **Ressincronizar agora?** para iniciar a ressincronização.

### Botão 🔄 Log Ressinc

Disponível sempre nos botões de acção. Ao clicar:

1. A extensão lê `.tess-log.md`
2. Injeta o log no chat como mensagem
3. O agente analisa o que já foi feito e informa o que falta concluir

Use este botão sempre que sentir que o agente "perdeu o fio" durante uma tarefa com múltiplas operações de ficheiros.

---

## 7. Histórico de conversas

Clique em **Histórico** na toolbar para abrir o drawer de sessões do workspace actual.

- Cada sessão é nomeada automaticamente com base na primeira mensagem
- Clique numa sessão para a restaurar
- Clique em **···** para renomear ou apagar

O histórico é por workspace — projectos diferentes têm sessões separadas.

---

## 8. Escolha de modelo

O selector de modelo na toolbar permite escolher o modelo para a próxima mensagem.

| Modelo | Melhor para |
|---|---|
| **Auto** | Deixar o agente Tess decidir |
| **Tess 5** | Tarefas gerais, mais económico |
| **Claude Opus 4.6** | Raciocínio complexo, arquitectura |
| **Claude Sonnet 4.6** | Equilíbrio entre qualidade e velocidade |
| **Claude Haiku 4.5** | Respostas rápidas, tarefas simples |
| **GPT-4o / GPT-4.1** | Alternativa OpenAI |
| **Gemini 2.5 Pro** | Contextos muito longos |
| **Gemini 2.0 Flash** | Velocidade máxima |

> Se o selector aparecer desactivado, o agente tem um modelo fixo configurado — não expõe escolha de modelo.

---

## 9. Resolução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| Painel bloqueado com aviso de configuração | `tess.apiKey` ou `tess.agentId` não preenchidos | `Ctrl+,` → pesquise `tess` |
| Selector de modelo desactivado | Agente com modelo fixo | Normal — use o agente tal como está |
| Resposta parou a meio | Timeout ou erro de rede | Clique **Parar** e tente novamente |
| Agente perdeu contexto das operações | Perda de sincronia durante tool calls | Clique **🔄 Log Ressinc** ou use o link ⚠️ no chat |
| `.tess-log.md` não é criado | Sem workspace aberto | Abra uma pasta no VS Code antes de usar ferramentas |
| Diálogo de confirmação não aparece | Operação de leitura (não requer confirmação) | Normal — apenas escrita/edição pede confirmação |
| Painel não aparece na barra lateral | Vista oculta | `View → Open View… → Tess Chat` |

---

*Tis Angola · [tis.ao](https://tis.ao)*
