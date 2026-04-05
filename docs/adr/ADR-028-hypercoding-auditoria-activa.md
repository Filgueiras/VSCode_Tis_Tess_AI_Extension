# ADR-028 — Auditoria Hypercoding activa

**Estado:** Aceite
**Data:** 2026-04-05

---

## Contexto

O manifesto Hypercoding (ADR-025, README) define cinco princípios de desenvolvimento sustentável e está incorporado no system prompt enviado a cada sessão. No entanto, a aplicação desses princípios era passiva — o agente os seguia ao responder, mas não os aplicava proactivamente ao código existente.

Para que o Hypercoding seja uma funcionalidade real e não apenas uma declaração de intenção, a extensão precisa de um mecanismo explícito que o utilizador possa invocar para obter uma análise estruturada do código activo, sem ter de construir a pergunta manualmente.

## Decisão

Adicionar o botão **🔍 Hypercoding** na barra de acção do chat. Ao clicar, a extensão analisa o ficheiro activo no editor (ou a selecção, se existir) segundo os cinco princípios do manifesto, usando o provider e modelo seleccionados.

## Prompt de auditoria

O prompt é estruturado e deliberadamente exigente — pede problemas concretos, não elogios genéricos. Inclui cinco secções correspondentes aos cinco princípios e termina com uma lista priorizada das três acções mais importantes.

```
## 1. Qualidade e clareza
## 2. Segurança
## 3. Eficiência
## 4. Manutenibilidade
## 5. Autonomia com supervisão
## Prioridade de acção
```

A instrução explícita "se um princípio estiver bem, uma linha chega" evita respostas infladas.

## Mecanismo

```
[clique em 🔍 Hypercoding]
    → webview: postMessage({ type: 'audit', model, provider })
    → provider.js: _handleAudit(msg)
        ├─ _resolveCredentials(provider)  — valida credenciais
        ├─ getCurrentCode()               — obtém ficheiro activo / selecção
        ├─ postMessage({ type: 'auditStart', filename })  — UI mostra entrada no chat
        ├─ constrói prompt estruturado
        └─ _dispatchStream()              — stream normal para o provider activo
```

A auditoria não injeta contexto do workspace nem histórico de conversa — analisa apenas o código do editor activo. Isto mantém o foco e evita consumo desnecessário de tokens.

O resultado é persistido no histórico da sessão como qualquer outra resposta do agente.

## Consequências

- A funcionalidade está disponível para todos os providers (Tess, TisAI, Ollama, Remoto)
- Se não houver ficheiro activo no editor, é mostrado um erro informativo
- O botão é desactivado enquanto há uma resposta em curso (`waiting === true`)
- A sessão é criada automaticamente se não existir (título "🔍 Auditoria Hypercoding")
- O Hypercoding deixa de ser apenas documentação — tem uma acção concreta associada
