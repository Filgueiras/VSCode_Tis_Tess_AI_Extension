# Architecture Decision Records (até versão 5.0.0)

Registo das decisões de arquitectura do projecto **Tis.ai — Hypercoding Multi-IA**.

Um ADR documenta uma decisão técnica significativa: o contexto que a motivou, o que foi decidido e as consequências dessa escolha.

---

| # | Título | Estado |
|---|--------|--------|
| [ADR-001](ADR-001-openai-compat-endpoint.md) | Endpoint OpenAI-compatível para streaming | Aceite |
| [ADR-002](ADR-002-webview-ui.md) | Interface via Webview em vez de Chat Participant nativo | Aceite |
| [ADR-003](ADR-003-sem-mcp.md) | Sem servidor MCP — chamada REST directa | Aceite |
| [ADR-004](ADR-004-sse-streaming.md) | Streaming SSE em vez de polling | Aceite |
| [ADR-005](ADR-005-javascript-sem-build.md) | JavaScript puro sem processo de build | ~~Aceite~~ Revertido |
| [ADR-006](ADR-006-sessao-persistente.md) | Sessão persistente com workspaceState | Aceite |
| [ADR-007](ADR-007-medidor-contexto.md) | Medidor de contexto com estimativa de tokens | Aceite |
| [ADR-008](ADR-008-modelos-dinamicos.md) | Modelos dinâmicos via GET /agents/{id} | Aceite |
| [ADR-009](ADR-009-bundle-e-publicacao.md) | Bundle com esbuild para publicação na Marketplace | Aceite |
| [ADR-010](ADR-010-configuracao-global-e-banner-nao-configurado.md) | Configuração global e banner de estado não configurado | Aceite |
| [ADR-011](ADR-011-modularizacao.md) | Modularização do código fonte | Aceite |
| [ADR-012](ADR-012-webview-ficheiros-estaticos.md) | WebView com ficheiros estáticos (CSS + JS externos) | Aceite |
| [ADR-013](ADR-013-tool-calling-tags.md) | Protocolo de Tool Calling via tags de texto | Aceite |
| [ADR-014](ADR-014-seguranca-xss-webview.md) | Segurança: prevenção de XSS no WebView (CSP + nonce) | Aceite |
| [ADR-015](ADR-015-retry-rate-limit.md) | Retry automático no erro 429 (Rate Limit) | Aceite |
| [ADR-016](ADR-016-dependencias-e-pacote.md) | Gestão de dependências no empacotamento da extensão | Aceite |
| [ADR-017](ADR-017-workflow-desenvolvimento-f5.md) | Workflow de desenvolvimento: build automático no F5 | Aceite |
| [ADR-018](ADR-018-separacao-camada-http.md) | Separação da camada HTTP da camada de orquestração | Aceite |
| [ADR-019](ADR-019-system-prompt-obrigatorio.md) | System prompt obrigatório em todas as chamadas à API Tess | Aceite |
| [ADR-020](ADR-020-mensagens-erro-amigaveis.md) | Mensagens de erro amigáveis para erros HTTP | Aceite |
| [ADR-021](ADR-021-convencao-webview-parametro.md) | Convenção de parâmetro Webview nas funções de workspace | Aceite |
| [ADR-022](ADR-022-integracao-agente-tools-alma-corpo.md) | Integração agente-ferramentas: ligar a alma ao corpo | Aceite |
| [ADR-023](ADR-023-feedback-visual-tools-e-ressinc.md) | Feedback visual de tool calls e ressincronização de sessão | Aceite |
| [ADR-024](ADR-024-deteccao-recuperacao-dessincronia.md) | Detecção e recuperação automática de dessincronia em tool calls | Aceite |
| [ADR-025](ADR-025-multi-provider-tess-tisai.md) | Suporte multi-provider: Tess e TisAI | Aceite |
| [ADR-026](ADR-026-rebrand-tis-tess-para-tis-code.md) | Rebrand: de tis-tess para tis-code | Aceite |
| [ADR-027](ADR-027-provider-registry-openai-compat.md) | Registry de providers e cliente OpenAI-compat genérico | Aceite |
| [ADR-028](ADR-028-hypercoding-auditoria-activa.md) | Auditoria Hypercoding activa | Aceite |
