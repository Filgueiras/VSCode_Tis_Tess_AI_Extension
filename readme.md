# Tess Tis — Assistente de Código IA para VS Code

> O seu agente de IA no editor. Desenvolvido por **[TIS Angola](https://tis.ao)**.

---

**Tess Tis** liga o VS Code directamente à plataforma [Tess.im](https://tess.im) — um hub de inteligência artificial que dá acesso aos melhores modelos do mundo (Claude, GPT, Gemini, e modelos próprios) através de agentes configuráveis. Com esta extensão, o seu agente fica disponível na barra lateral do editor, com contexto de código automático, streaming em tempo real e sessões persistentes.

---

## Funcionalidades

### Contexto de projecto automático
Na primeira mensagem de cada sessão, a estrutura completa do projecto é enviada silenciosamente ao agente. Não precisa de explicar onde estão os ficheiros — o agente já sabe.

### Ficheiros a pedido
Clique em **📁 Adicionar ficheiros** para abrir o selector nativo do VS Code e incluir qualquer ficheiro do projecto no contexto — sem precisar de o ter aberto no editor.

### Sessões persistentes
A conversa é guardada automaticamente por projecto. Feche e reabra o VS Code quando quiser — a sessão retoma exactamente onde ficou.

### Medidor de contexto
Uma barra de progresso discreta mostra a percentagem do contexto utilizado em tempo real. Muda de cor conforme o limite se aproxima (verde → amarelo → vermelho) para saber exactamente quando recomeçar uma nova conversa.

### Modelos dinâmicos
A extensão consulta o agente configurado e apresenta apenas os modelos que esse agente permite. Se o agente estiver bloqueado num único modelo, o selector desaparece — sem opções fictícias.

### Streaming em tempo real
As respostas chegam progressivamente, tal como no ChatGPT ou Claude.ai. Pode parar uma resposta a qualquer momento.

### Menu de contexto no editor
Clique direito em qualquer ficheiro → **Tess: Chat com Código Actual** para abrir o chat com o código seleccionado já incluído.

---

## Configuração

### 1. Criar um token na Tess

Aceda a [tess.im/dashboard/user/tokens](https://tess.im/dashboard/user/tokens) e crie um token de API. Guarde-o — só é mostrado uma vez.

### 2. Criar um agente Chat

1. Em [tess.im](https://tess.im), crie um agente do tipo **Chat**
2. Abra o agente criado — o URL terá o formato:
   ```
   https://tess.im/dashboard/agents/12345/edit
   ```
3. O **Agent ID** é o número no URL (`12345`)

### 3. Configurar a extensão

`Ctrl+,` → pesquise `tess`:
________________________________________________________
| Definição      | O que preencher                     |
|----------------|-------------------------------------|
| `tess.apiKey`  | O token criado no passo 1           |
| `tess.agentId` | O número do URL do agente (passo 2) |
--------------------------------------------------------

Após guardar as definições, a extensão detecta automaticamente os modelos disponíveis no agente.

---

## Interface

```
┌─────────────────────────────────────────────────┐
│  Tess Tis                                       │
│  Modelo: [Claude Sonnet 4.5 ▾]       [Limpar]   │
├─────────────────────────────────────────────────┤
│                                                 │
│                      Você:                      │
│         o que faz a função processData?   ───►  │
│                                                 │
│  ◄───  Tess AI:                                 │
│        A função recebe um array de objectos     │
│        e aplica três transformações...          │
│                                                 │
│                      Você:                      │
│         e se o array vier vazio?          ───►  │
│                                                 │
│  ◄───  Tess AI:                                 │
│        Nesse caso retorna imediatamente...      │
│                                                 │
├─────────────────────────────────────────────────┤
│  [ Adicionar ficheiros ]                        │
│  [Escreva aqui...                  ] [Enviar]   │
│  ████████████░░░░░░░░  ~24K / 200K tok          │
└─────────────────────────────────────────────────┘
```

---

## Modelos suportados

Os modelos disponíveis dependem da configuração do agente Tess ligado. A extensão detecta-os automaticamente. Os modelos suportados pela plataforma incluem:
____________________________________________________
| Fornecedor    | Modelos                          |
|---------------|----------------------------------|
| **Tess**      | Tess 5 (modelo próprio)          |
| **Anthropic** | Claude Opus, Sonnet e Haiku 4.5  |
| **OpenAI**    | GPT-4o, GPT-4.1                  |
| **Google**    | Gemini 2.5 Pro, Gemini 2.0 Flash |
----------------------------------------------------

## Requisitos

- VS Code 1.60 ou superior
- Conta em [tess.im](https://tess.im) com um agente Chat criado
- Token de API da Tess

---

## Sobre a TIS Angola

**TIS Angola** é uma consultoria angolana de tecnologia e inovação, dedicada a levar ferramentas de desenvolvimento modernas às equipas de software em Angola e na lusofonia.

Esta extensão nasceu do nosso compromisso com o **Manifesto Hypercoding** — a convicção de que a IA deve amplificar a capacidade dos programadores, não substituir o pensamento crítico. Conheça o manifesto em [hypercoding.io](https://hypercoding.io).

- Site: [tis.ao](https://tis.ao)
- Autor: Marco Guimarães
- Versão: 2.0.0 · Lançamento: Março 2026

---

*Publisher: `tis-angola` · ID: `tis-angola.tess-tis`*