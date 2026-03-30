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

### cURL

**Resposta simples:**
```bash
curl -s -X POST "https://api.tess.im/agents/12345/openai/chat/completions" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "Explica o que é uma API REST em 3 linhas" }
    ]
  }'
```

**Streaming:**
```bash
curl -s -X POST "https://api.tess.im/agents/12345/openai/chat/completions" \
  -H "Authorization: Bearer SEU_TOKEN" \
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

```javascript
const AGENT_ID = '12345';
const API_KEY  = 'SEU_TOKEN';

async function perguntarTess(mensagem) {
  const response = await fetch(
    `https://api.tess.im/agents/${AGENT_ID}/openai/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: mensagem }]
      })
    }
  );

  const data = await response.json();
  return data.choices[0].message.content;
}

perguntarTess('O que é uma closure em JavaScript?').then(console.log);
```

**Com streaming (Node.js):**
```javascript
async function perguntarTessStream(mensagem) {
  const response = await fetch(
    `https://api.tess.im/agents/${AGENT_ID}/openai/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: mensagem }],
        stream: true
      })
    }
  );

  for await (const chunk of response.body) {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') break;
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
import requests

AGENT_ID = "12345"
API_KEY  = "SEU_TOKEN"

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
import requests
import json

def perguntar_tess_stream(mensagem: str):
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
            pass
```

---

### SDK OpenAI (Python ou JS)

Como o endpoint é compatível com OpenAI, podes usar o SDK oficial mudando apenas a `base_url`:

**Python:**
```python
from openai import OpenAI

client = OpenAI(
    api_key="SEU_TOKEN",
    base_url="https://api.tess.im/agents/12345/openai"
)

response = client.chat.completions.create(
    model="tess-5",
    messages=[{"role": "user", "content": "Olá!"}]
)
print(response.choices[0].message.content)
```

**JavaScript:**
```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'SEU_TOKEN',
  baseURL: 'https://api.tess.im/agents/12345/openai'
});

const response = await client.chat.completions.create({
  model: 'tess-5',
  messages: [{ role: 'user', content: 'Olá!' }]
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
  -H "Authorization: Bearer SEU_TOKEN"
```

A resposta é paginada e inclui para cada agente: `id`, `slug`, `title`, `type`, `visibility`.

---

## Com o plugin Tess Tis para VS Code

Se preferires usar esta funcionalidade directamente no VS Code sem escrever código:

1. Instala a extensão **Tess Tis** (`tis-angola.tess-tis`)
2. Em `Ctrl+,`, configura `tess.apiKey` e `tess.agentId`
3. Clica no ícone Tess na barra lateral

A extensão faz exactamente as chamadas documentadas acima, inclui automaticamente o código do editor activo como contexto e suporta streaming em tempo real.

Consulta o [README](readme.md) para mais detalhes sobre a extensão.

---

*Documentação gerada para a versão 2.0.0 da extensão Tess Tis · TIS Angola*
