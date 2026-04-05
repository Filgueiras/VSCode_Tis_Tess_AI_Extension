# Guia de Ligação à API Tess

> Como conectar a um agente Tess a partir de qualquer ferramenta ou linguagem

---

## Conceitos base

A [Tess](https://tess.im) é uma plataforma de IA que permite criar agentes baseados em LLMs (Claude, GPT, Gemini, entre outros). Cada agente tem um **ID numérico** único e é acedido via API REST com autenticação por token Bearer.

Para comunicar com um agente precisas de dois valores:

| Valor | Onde obter |
|---|---|
| **API Key** | [tess.im/dashboard/user/tokens](https://tess.im/dashboard/user/tokens) |
| **Agent ID** | Número no URL do agente: `tess.im/dashboard/agents/**12345**/edit` |

> **Segurança:** Nunca coloque a API Key directamente no código. Use sempre variáveis de ambiente (ver exemplos abaixo).

---

## Endpoint principal

```
POST https://api.tess.im/agents/{agentId}/openai/chat/completions
```

Este endpoint é compatível com o formato OpenAI, o que significa que qualquer SDK ou ferramenta que suporte OpenAI funciona apenas mudando a base URL.

---

## Formato do pedido

**Headers obrigatórios:**
```
Authorization: Bearer SEU_TOKEN
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "messages": [
    { "role": "user", "content": "A tua pergunta aqui" }
  ],
  "stream": false
}
```

**Parâmetros opcionais:**

| Campo | Tipo | Descrição |
|---|---|---|
| `model` | string | Modelo a usar (ver lista abaixo). Omitir = agente decide |
| `stream` | boolean | `true` para streaming SSE, `false` para resposta única |
| `temperature` | number | Criatividade da resposta (0.0 a 1.0) |

**Modelos disponíveis:**

| ID | Descrição |
|---|---|
| `tess-5` | Modelo próprio Tess |
| `claude-opus-4-5` | Claude Opus 4.5 (Anthropic) |
| `claude-sonnet-4-5` | Claude Sonnet 4.5 (Anthropic) |
| `claude-haiku-4-5` | Claude Haiku 4.5 (Anthropic) |
| `gpt-4o` | GPT-4o (OpenAI) |
| `gpt-4.1` | GPT-4.1 (OpenAI) |
| `gemini-2.5-pro` | Gemini 2.5 Pro (Google) |
| `gemini-2.0-flash` | Gemini 2.0 Flash (Google) |

**Formato do histórico de conversa:**
```json
{
  "messages": [
    { "role": "user",      "content": "Olá, podes ajudar-me?" },
    { "role": "assistant", "content": "Claro, como posso ajudar?" },
    { "role": "user",      "content": "Explica o que é uma closure em JS" }
  ]
}
```

> As mensagens devem alternar entre `user` e `assistant`. O papel `system` não é suportado neste endpoint.

---

## Exemplos por ferramenta

### Variáveis de ambiente (configuração prévia)

Antes de correr qualquer exemplo, defina as variáveis de ambiente:

**Windows (PowerShell):**
```powershell
$env:TESS_AGENT_ID = "12345"
$env:TESS_API_KEY  = "o_teu_token_aqui"
```

**macOS / Linux (Bash):**
```bash
export TESS_AGENT_ID="12345"
export TESS_API_KEY="o_teu_token_aqui"
```

---

### cURL

**Resposta simples:**
```bash
curl -s -X POST "https://api.tess.im/agents/${TESS_AGENT_ID}/openai/chat/completions" \
  -H "Authorization: Bearer ${TESS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "Explica o que é uma API REST em 3 linhas" }
    ]
  }'
```

**Streaming:**
```bash
curl -s -X POST "https://api.tess.im/agents/${TESS_AGENT_ID}/openai/chat/completions" \
  -H "Authorization: Bearer ${TESS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "Explica o que é uma API REST" }
    ],
    "stream": true
  }'
```

---

### JavaScript / Node.js (fetch)

> Requer Node.js 18+. Para versões anteriores use o SDK OpenAI (ver abaixo) ou a biblioteca `node-fetch`.

```javascript
const AGENT_ID = process.env.TESS_AGENT_ID;
const API_KEY  = process.env.TESS_API_KEY;

async function perguntarTess(mensagem) {
  const response = await fetch(
    `https://api.tess.im/agents/${AGENT_ID}/openai/chat/completions`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: mensagem }]
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Tess API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

perguntarTess("O que é uma closure em JavaScript?").then(console.log);
```

**Com streaming (Node.js 18+):**
```javascript
async function perguntarTessStream(mensagem) {
  const response = await fetch(
    `https://api.tess.im/agents/${AGENT_ID}/openai/chat/completions`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: mensagem }],
        stream: true
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Tess API error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split("\n");
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") return;
      try {
        const parsed = JSON.parse(raw);
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) process.stdout.write(text);
      } catch { /* chunk incompleto */ }
    }
  }
}
```

---

### Python (requests)

```python
import os
import requests

AGENT_ID = os.environ["TESS_AGENT_ID"]
API_KEY  = os.environ["TESS_API_KEY"]

def perguntar_tess(mensagem: str) -> str:
    response = requests.post(
        f"https://api.tess.im/agents/{AGENT_ID}/openai/chat/completions",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "messages": [{"role": "user", "content": mensagem}]
        }
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]

print(perguntar_tess("O que é uma closure em Python?"))
```

**Com streaming (Python):**
```python
import os
import json
import requests

AGENT_ID = os.environ["TESS_AGENT_ID"]
API_KEY  = os.environ["TESS_API_KEY"]

def perguntar_tess_stream(mensagem: str) -> None:
    response = requests.post(
        f"https://api.tess.im/agents/{AGENT_ID}/openai/chat/completions",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "messages": [{"role": "user", "content": mensagem}],
            "stream": True
        },
        stream=True
    )
    response.raise_for_status()

    for line in response.iter_lines():
        if not line:
            continue
        decoded = line.decode("utf-8")
        if not decoded.startswith("data: "):
            continue
        raw = decoded[6:].strip()
        if raw == "[DONE]":
            break
        try:
            parsed = json.loads(raw)
            text = parsed.get("choices", [{}])[0].get("delta", {}).get("content")
            if text:
                print(text, end="", flush=True)
        except json.JSONDecodeError:
            pass  # chunk incompleto, ignorar
```

---

### SDK OpenAI (Python ou JS)

Como o endpoint é compatível com OpenAI, podes usar o SDK oficial mudando apenas a `base_url`.

> **Como funciona:** O SDK acrescenta automaticamente `/chat/completions` à `base_url`. Por isso a base URL termina em `/openai` — o path completo resultante é `/agents/{id}/openai/chat/completions`.

**Python:**
```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["TESS_API_KEY"],
    base_url=f"https://api.tess.im/agents/{os.environ['TESS_AGENT_ID']}/openai"
)

response = client.chat.completions.create(
    model="tess-5",
    messages=[{"role": "user", "content": "Olá!"}]
)
print(response.choices[0].message.content)
```

**JavaScript:**
```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.TESS_API_KEY,
  baseURL: `https://api.tess.im/agents/${process.env.TESS_AGENT_ID}/openai`
});

const response = await client.chat.completions.create({
  model: "tess-5",
  messages: [{ role: "user", content: "Olá!" }]
});
console.log(response.choices[0].message.content);
```

---

## Formato da resposta SSE (streaming)

Cada linha do stream segue o formato Server-Sent Events:

```
data: {"choices":[{"delta":{"role":"assistant","content":"Olá"},"index":0}],"model":"tess-5"}

data: {"choices":[{"delta":{"content":", como"},"index":0}],"model":"tess-5"}

data: {"choices":[{"delta":{"content":" posso ajudar?"},"index":0}],"model":"tess-5"}

data: [DONE]
```

O conteúdo incremental está sempre em `choices[0].delta.content`. O stream termina com `data: [DONE]`.

---

## Listar agentes disponíveis

```bash
curl -s "https://api.tess.im/api/agents" \
  -H "Authorization: Bearer ${TESS_API_KEY}"
```

A resposta é paginada e inclui para cada agente: `id`, `slug`, `title`, `type`, `visibility`.

---

## Com a extensão Tis.ai para VS Code

Se preferires usar a API da Tess directamente no VS Code sem escrever código:

1. Instala a extensão **Tis.ai** (`tis-angola.tis-code`)
2. Em `Ctrl+,`, configura `tis.tessApiKey` e selecciona Tess como provider
3. Clica no ícone Tis.ai na barra lateral

A extensão suporta múltiplos providers (Tess, TisAI, Ollama, remoto), inclui automaticamente o código do editor activo como contexto e suporta streaming em tempo real.

Consulta o [README](readme.md) para mais detalhes sobre a extensão.

---

*Documentação gerada para a versão 5.0.0 da extensão Tis.ai · TIS Angola*