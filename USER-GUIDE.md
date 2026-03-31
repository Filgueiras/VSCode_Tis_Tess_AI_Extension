# Guia do Utilizador — Tess Tis

> Como instalar, configurar e tirar o máximo partido da extensão no dia-a-dia.

---

## Índice

1. [Instalação](#1-instalação)
2. [Configuração inicial](#2-configuração-inicial)
3. [Abrir e fechar o painel](#3-abrir-e-fechar-o-painel)
4. [Escolher o modelo](#4-escolher-o-modelo)
5. [Conversar com o agente](#5-conversar-com-o-agente)
6. [O que é enviado automaticamente](#6-o-que-é-enviado-automaticamente)
7. [Adicionar ficheiros manualmente](#7-adicionar-ficheiros-manualmente)
8. [Medidor de contexto](#8-medidor-de-contexto)
9. [Sessões persistentes](#9-sessões-persistentes)
10. [Atalhos e menu de contexto](#10-atalhos-e-menu-de-contexto)

---

## 1. Instalação

Instale a extensão a partir do Marketplace do VS Code:

1. Abra o VS Code
2. `Ctrl+Shift+X` → pesquise `Tess Tis`
3. Clique em **Install**

Ou instale manualmente a partir de um ficheiro `.vsix`:

```
Extensions (Ctrl+Shift+X) → ··· → Install from VSIX…
```

---

## 2. Configuração inicial

A extensão precisa de dois valores para funcionar: uma **API Key** e um **Agent ID**. Sem eles, não é possível enviar mensagens.

### Obter a API Key

1. Aceda a [tess.im/dashboard/user/tokens](https://tess.im/dashboard/user/tokens)
2. Crie um novo token e copie-o — **é mostrado uma única vez**

### Obter o Agent ID

1. Em [tess.im](https://tess.im), crie ou abra um agente do tipo **Chat**
2. O URL da página de edição tem o formato:
   ```
   https://tess.im/dashboard/agents/12345/edit
   ```
3. O número no URL (`12345`) é o **Agent ID**

### Configurar no VS Code

`Ctrl+,` → pesquise `tess`:

| Definição      | O que preencher                               |
|----------------|-----------------------------------------------|
| `tess.apiKey`  | O token criado em tess.im/dashboard/user/tokens |
| `tess.agentId` | O número do URL do agente                     |

> **Nota:** estas definições têm âmbito global (`application`) — são configuradas uma única vez e ficam disponíveis em todos os workspaces. Não é necessário repetir a configuração ao abrir um projecto diferente.

Após guardar, a extensão detecta a alteração automaticamente e activa o painel sem necessidade de recarregar o VS Code.

---

## 3. Abrir e fechar o painel

O painel da Tess Tis fica na **barra lateral** do VS Code.

### Mostrar o painel

- Clique no ícone da Tess na **Activity Bar** (barra vertical de ícones à esquerda)
- Ou use o menu: **View → Open View… → Tess Chat**

### Ocultar o painel

- Clique novamente no ícone da Tess na Activity Bar — o painel fecha
- Ou clique com o botão direito no ícone → **Hide**

### Mover o painel

O painel pode ser arrastado para qualquer posição na barra lateral, ou movido para o painel inferior (`View → Appearance → Panel`), como qualquer outra vista do VS Code.

---

## 4. Escolher o modelo

No topo do painel existe um selector de modelo:

```
Modelo: [Claude Sonnet 4.5 ▾]
```

- A lista é carregada dinamicamente a partir do agente configurado
- Apenas aparecem os modelos que o agente suporta
- Se o agente estiver bloqueado num único modelo, o selector não é mostrado
- A escolha é guardada entre sessões — não precisa de seleccionar de novo ao reabrir o VS Code

### Quando usar cada modelo

| Modelo | Melhor para |
|--------|-------------|
| **Auto** | Deixar o agente Tess decidir o mais adequado |
| **Tess 5** | Tarefas gerais, mais económico |
| **Claude Opus 4.5** | Raciocínio complexo, arquitectura, revisão profunda |
| **Claude Sonnet 4.5** | Equilíbrio entre qualidade e velocidade |
| **Claude Haiku 4.5** | Respostas rápidas, tarefas simples |
| **GPT-4o / GPT-4.1** | Alternativa OpenAI |
| **Gemini 2.5 Pro** | Contextos muito longos |
| **Gemini 2.0 Flash** | Velocidade máxima |

---

## 5. Conversar com o agente

1. Escreva a sua pergunta ou instrução na caixa de texto no fundo do painel
2. Prima `Enter` ou clique em **Enviar**
3. A resposta aparece em streaming — letra a letra, em tempo real
4. Para **parar** uma resposta a meio, clique no botão **Cancelar** que aparece durante o streaming

O histórico da conversa mantém-se visível durante toda a sessão. Clique em **Limpar** no topo para começar uma nova conversa.

---

## 6. O que é enviado automaticamente

A extensão enriquece cada mensagem com contexto do seu projecto, de forma silenciosa.

### Árvore do projecto (primeira mensagem)

Na **primeira mensagem** de cada sessão, é injectada automaticamente a lista de todos os ficheiros do projecto (até 300), excluindo pastas como `node_modules`, `.git` e `dist`.

O agente fica a saber a estrutura do projecto sem que precise de a descrever.

### Código do editor activo (todas as mensagens)

Em **cada mensagem**, o conteúdo do ficheiro aberto no editor é incluído automaticamente no contexto.

- Se tiver **texto seleccionado**, apenas a selecção é enviada
- Se não houver selecção, o ficheiro completo é enviado

Isto significa que pode perguntar directamente "o que faz esta função?" sem precisar de copiar código para o chat.

---

## 7. Adicionar ficheiros manualmente

O botão **📁 Adicionar ficheiros** serve para incluir o **conteúdo completo** de ficheiros que não estão abertos no editor.

### Quando usar

- Precisa que o agente veja um ficheiro de configuração (ex: `docker-compose.yml`, `.env.example`)
- Quer comparar dois ficheiros num único pedido
- O ficheiro relevante está fechado no editor e não quer mudar de separador

### Como usar

1. Clique em **📁 Adicionar ficheiros**
2. Seleccione um ou mais ficheiros no explorador nativo do VS Code
3. O conteúdo é inserido na área de texto, pronto para ser enviado com a próxima mensagem

> **Diferença do contexto automático:** o contexto automático envia a *lista de ficheiros* e o *ficheiro activo*. O botão Adicionar envia o *conteúdo* de ficheiros à sua escolha.

---

## 8. Medidor de contexto

Na base do painel existe uma barra de progresso que mostra o contexto consumido:

```
████████████░░░░░░░░  ~24K / 200K tok
```

- **Verde** — contexto confortável, pode continuar
- **Amarelo** — a aproximar-se do limite, considere condensar ou perguntar o essencial
- **Vermelho** — limite próximo, recomenda-se começar uma nova conversa (botão **Limpar**)

O valor exibido é uma estimativa baseada no histórico da conversa e nos ficheiros incluídos.

---

## 9. Sessões persistentes

A conversa é guardada automaticamente por projecto (workspace). Ao fechar e reabrir o VS Code:

- O histórico de mensagens é restaurado
- O modelo seleccionado é mantido
- O medidor de contexto reflecte o estado anterior

Cada workspace tem a sua própria sessão independente — abrir um projecto diferente inicia uma conversa separada. As credenciais (`tess.apiKey` e `tess.agentId`), porém, são globais e partilhadas entre todos os workspaces.

---

## 10. Atalhos e menu de contexto

### Menu de contexto no editor

Clique com o botão direito em qualquer ficheiro ou selecção de código → **Tess: Chat com Código Actual**

- Se tiver texto seleccionado, apenas a selecção é incluída no contexto
- Se não houver selecção, o ficheiro completo é usado
- O painel da Tess abre automaticamente se estiver fechado

### Atalho de teclado (opcional)

Pode configurar um atalho personalizado para abrir o painel:

`Ctrl+Shift+P` → **Preferences: Open Keyboard Shortcuts** → pesquise `tess`

---

## Resolução de problemas

| Sintoma | Causa provável | Solução |
|---------|---------------|---------|
| Painel mostra aviso de configuração e inputs bloqueados | `tess.apiKey` ou `tess.agentId` não preenchidos | Clique no ícone ⚙ no topo do painel ou `Ctrl+,` → pesquise `tess` |
| "API Key não configurada" ao enviar mensagem | `tess.apiKey` vazio | `Ctrl+,` → preencher `tess.apiKey` |
| "Agent ID não configurado" ao enviar mensagem | `tess.agentId` vazio | `Ctrl+,` → preencher `tess.agentId` |
| Selector de modelo não aparece | Agente com modelo fixo | Normal — o agente não expõe escolha de modelo |
| Resposta parou a meio | Timeout ou erro de rede | Clique Cancelar e tente novamente |
| Painel não aparece na barra lateral | Vista oculta | `View → Open View… → Tess Chat` |

---

*Guia do utilizador para a versão 2.1.0 da extensão Tess Tis · [TIS Angola](https://tis.ao)*
