# Tis.ai — Hypercoding Multi-IA

> Versão 5.0.0 · [TIS Angola](https://tis.ao)

Extensão para VS Code que integra múltiplos assistentes de IA directamente no editor, com suporte a **[Tess](https://tess.im)**, **TisAI**, **Ollama** (local) e qualquer endpoint remoto compatível com OpenAI.

Mantém contexto do projecto, histórico de conversas por workspace, tool calling com leitura e escrita de ficheiros, e auditoria activa de código segundo os princípios Hypercoding.

---

## O Manifesto Hypercoding

**Hypercoding** é a prática de desenvolver software com IA como co-piloto permanente — não para substituir o pensamento humano, mas para amplificá-lo.

O objectivo não é gerar código mais depressa. É gerar **código melhor**, com maior consciência das suas consequências: para quem o mantém, para quem o usa, e para os sistemas em que corre.

### Os cinco compromissos

**1. Qualidade antes de velocidade**
O Hypercoding rejeita a lógica de "funciona, já chega". Código que funciona mas é ilegível, inseguro ou frágil cria dívida que outros pagarão. A IA deve questionar atalhos — não apenas executá-los.

**2. Segurança por defeito**
Credenciais no código, inputs sem validação, dependências sem auditoria — são falhas de responsabilidade, não apenas de técnica. O assistente sinaliza riscos de segurança sem esperar que se peça.

**3. Eficiência como princípio ambiental**
Código que desperdiça recursos (loops desnecessários, queries sem índice, re-renders em excesso) tem custo energético real. Simplicidade e eficiência não são purismo — são responsabilidade.

**4. Manutenibilidade como acto de respeito**
O código que escrevemos hoje será lido por outros amanhã — talvez por nós próprios, num dia em que não nos lembramos de nada. Nomear bem, documentar o que não é óbvio e estruturar com clareza são actos de respeito pelo trabalho colectivo.

**5. Autonomia com supervisão humana**
A IA executa, o humano decide. O assistente pode ler e propor; só altera o que o utilizador aprovar explicitamente. Velocidade sem controlo não é Hypercoding — é imprudência.

---

## Funcionalidades

- **Multi-provider** — Tess, TisAI, Ollama (local) e endpoint remoto, seleccionáveis por dropdown
- **🔍 Auditoria Hypercoding** — analisa o ficheiro activo segundo os 5 princípios, com prioridade de acção
- **Chat com streaming** — respostas em tempo real no painel lateral
- **Contexto automático** — ficheiro activo (ou selecção) incluído em cada mensagem
- **Árvore do projecto** — injectada na primeira mensagem de cada sessão
- **Histórico por workspace** — cada projecto tem as suas próprias conversas
- **Tool calling com confirmação** — leitura autónoma; escrita requer aprovação explícita
- **Feedback visual de operações** — cada acção aparece no chat em tempo real
- **Log local de acções** — registo cumulativo em `.tis-log.md` no workspace
- **Ressincronização de sessão** — detecção automática de perda de sincronia e recuperação via log
- **Medidor de contexto** — tokens consumidos em tempo real com aviso de proximidade ao limite
- **Modelos dinâmicos** — lista actualizada via API para Tess e TisAI; descoberta automática para Ollama

---

## Instalação

1. `Ctrl+Shift+X` → pesquise **Tis.ai**
2. Clique em **Install**

Ou instale manualmente via `Extensions (···) → Install from VSIX…`

---

## Configuração

`Ctrl+,` → pesquise `tis`. Configure apenas o(s) provider(s) que vai usar.

### Tess
| Definição | O que preencher |
|---|---|
| `tis.tessApiKey` | Token de [tess.im/dashboard/user/tokens](https://tess.im/dashboard/user/tokens) |
| `tis.tessAgentId` | Número no URL do agente — `tess.im/dashboard/agents/12345/edit` |

### TisAI
| Definição | O que preencher |
|---|---|
| `tis.tisAiApiKey` | Chave do painel TisAI — formato `tis_...` |
| `tis.tisAiAssistantId` | (Opcional) ID do assistente TisAI |

### Ollama (local)
| Definição | O que preencher |
|---|---|
| `tis.ollama.baseUrl` | URL do servidor Ollama (padrão: `http://localhost:11434`) |

### Endpoint remoto
| Definição | O que preencher |
|---|---|
| `tis.remote.endpoint` | URL base — ex: `https://meuservidor.com/v1` |
| `tis.remote.apiKey` | (Opcional) Chave API — enviada como `Authorization: Bearer` |
| `tis.remote.model` | (Opcional) Modelo por omissão |

> O endpoint remoto deve suportar `POST /chat/completions` com streaming SSE no formato OpenAI.

---

## Providers e modelos

O dropdown **"Ligação:"** alterna entre os providers. A lista de modelos actualiza automaticamente ao mudar.

| Provider | Modelos | Descoberta |
|---|---|---|
| **Tess** | Dinâmicos conforme o agente | `GET /agents/{id}` |
| **TisAI** | DeepSeek, Llama, Qwen e outros | `GET /models` → estático |
| **Ollama** | Os modelos instalados localmente | `GET /api/tags` |
| **Remoto** | Dependente do servidor | `GET /models` → modelo fixo configurado |

---

## Auditoria Hypercoding

Clique em **🔍 Hypercoding** na barra de acção para analisar o ficheiro activo no editor.

A auditoria examina o código segundo os 5 princípios e devolve:
- Problemas concretos em cada dimensão (qualidade, segurança, eficiência, manutenibilidade, autonomia)
- **Prioridade de acção** — as 3 coisas mais importantes a corrigir, por ordem de impacto

Funciona com qualquer provider seleccionado.

---

## Tool calling

O agente pode interagir com os ficheiros do projecto:

| Operação | Confirmação |
|---|---|
| Ler ficheiro / listar directoria / ver estrutura | Não |
| Criar ou editar ficheiro | **Sim** — diálogo modal |

Todas as operações ficam registadas em `.tis-log.md`. Se a ligação cair durante uma sequência, o botão **🔄 Log Ressinc** injeta o log no chat para o agente retomar.

---

## Resolução de problemas

| Sintoma | Solução |
|---|---|
| "API Key ou Agent ID Tess não configurados" | `Ctrl+,` → `tis.tessApiKey` + `tis.tessAgentId` |
| "Chave API TisAI não configurada" | `Ctrl+,` → `tis.tisAiApiKey` |
| "Endpoint remoto não configurado" | `Ctrl+,` → `tis.remote.endpoint` |
| Ollama mostra "não detectado" | Verifique se o servidor Ollama está a correr em `tis.ollama.baseUrl` |
| Selector de modelo desactivado (Tess) | Agente com modelo fixo — comportamento normal |
| Resposta parou a meio | Clique **Parar** e tente novamente |
| Agente perdeu contexto de operações | **🔄 Log Ressinc** ou siga o aviso ⚠️ |
| Painel não aparece | `View → Open View… → Chat Tis.ai` |

---

## Migração

| Versão | Alteração |
|---|---|
| v3.x → v4.x | `tess.apiKey` → `tis.tessApiKey` · `tess.agentId` → `tis.tessAgentId` |
| v4.x → v5.x | Sem quebra de configuração — apenas funcionalidades novas |

---

## Requisitos

- VS Code 1.60 ou superior
- Para Tess: conta em [tess.im](https://tess.im) com agente do tipo **Chat**
- Para TisAI: chave API em [ai.tisdev.cloud](https://ai.tisdev.cloud)
- Para Ollama: [ollama.com](https://ollama.com) instalado localmente ou servidor acessível
- Para Remoto: qualquer servidor com `POST /chat/completions` e streaming SSE formato OpenAI
