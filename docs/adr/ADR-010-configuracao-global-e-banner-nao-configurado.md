# ADR-010 — Configuração global e banner de estado não configurado

**Estado:** Aceite  
**Data:** 2026-03-31

---

## Contexto

Dois problemas foram identificados em conjunto após a versão 2.0.0:

### Problema 1 — Credenciais perdidas ao trocar de workspace

As definições `tess.apiKey` e `tess.agentId` não tinham âmbito declarado no `package.json`. Em VS Code, o comportamento por omissão permite que estas definições sejam armazenadas a nível de workspace. Quando o utilizador configurava a extensão num projecto e depois abria um projecto diferente, as credenciais não estavam presentes — a extensão entrava no estado "não configurado" sem aviso claro.

### Problema 2 — UI bloqueada silenciosamente quando há histórico guardado

Quando a extensão arrancava com histórico de sessão guardado, o fluxo era:

1. `resolveWebviewView` restaura o histórico → `appendMessage` remove o elemento `#empty` do DOM
2. `_syncConfig()` dispara (150 ms depois) → sem credenciais → envia `notConfigured`
3. O handler de `notConfigured` desabilitava os inputs e tentava actualizar `#empty`... que já não existia

Resultado: o utilizador via o chat antigo com todos os inputs desabilitados e **nenhuma mensagem a explicar porquê**. A interface parecia congelada, sem caminho óbvio para resolver.

---

## Decisão

### Fix 1 — Âmbito `application` para as credenciais

Adicionado `"scope": "application"` a ambas as propriedades no `package.json`:

```json
"tess.apiKey":  { "scope": "application", ... }
"tess.agentId": { "scope": "application", ... }
```

Com âmbito `application`, as definições ficam armazenadas no perfil global do utilizador e estão disponíveis em todos os workspaces, independentemente do projecto aberto.

### Fix 2 — Banner persistente em vez de actualização condicional do `#empty`

O handler `notConfigured` no webview foi alterado para inserir um banner dedicado (`#not-configured-banner`) no topo da área de mensagens quando `#empty` não existe:

```javascript
case 'notConfigured':
    // ... desabilita inputs ...
    const banner = document.getElementById('not-configured-banner')
                || document.createElement('div');
    banner.id = 'not-configured-banner';
    // inserido antes de #messages se #empty não existir
```

O handler `setModels` (que activa o estado "configurado") remove o banner quando as credenciais são preenchidas e a extensão re-sincroniza.

---

## Consequências

- As credenciais são configuradas uma única vez e funcionam em todos os workspaces.
- O utilizador vê sempre uma mensagem clara e um caminho de acção (ícone ⚙ ou `Ctrl+,`) quando a extensão não está configurada, mesmo que haja histórico de sessão visível.
- Não há regressão nas sessões persistentes — o histórico continua a ser por workspace; apenas as credenciais passaram a ser globais.
