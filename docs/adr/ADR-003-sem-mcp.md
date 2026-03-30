# ADR-003 — Sem servidor MCP — chamada REST directa

**Estado:** Aceite
**Data:** 2026-03-30

---

## Contexto

O VS Code suporta servidores MCP (Model Context Protocol) que expõem ferramentas e recursos a agentes de IA como o GitHub Copilot. Foi equacionado se a extensão deveria implementar um servidor MCP para a integração com a Tess.

## Decisão

Não implementar um servidor MCP. A extensão comunica directamente com a API REST da Tess via `axios`.

## Razão

- MCP resolve um problema diferente: expor ferramentas a agentes de IA existentes (Copilot, Claude). O objectivo desta extensão é o inverso — ser ela própria o agente de IA no editor
- Um servidor MCP implicaria um processo separado, configuração adicional pelo utilizador e uma camada de complexidade sem benefício funcional
- A API da Tess é REST/HTTP simples; `axios` é suficiente e directo
- Manter o projecto sem MCP reduz a superfície de erro e mantém o número de dependências no mínimo

## Consequências

- A extensão não aparece como ferramenta disponível para outros agentes de IA no VS Code
- A instalação é simples: sem servidores adicionais para arrancar ou configurar
- Se no futuro a Tess expuser capacidades que façam sentido como ferramentas MCP (ex: pesquisa de conhecimento, execução de código), pode ser adicionada uma camada MCP sem afectar a arquitectura actual
