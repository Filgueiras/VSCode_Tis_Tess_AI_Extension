# ADR-014 — Segurança: prevenção de XSS no WebView

**Estado:** Aceite
**Data:** 2026-04-01

## Contexto

O renderer original usava `innerHTML +=` para acrescentar texto da API ao chat. Qualquer resposta do agente que contivesse HTML seria interpretada e executada directamente no WebView — uma vulnerabilidade de XSS clássica. Dado que o conteúdo vem de uma API externa, mesmo que controlada, a extensão não deve confiar cegamente no conteúdo como HTML seguro.

## Decisão

Três camadas de protecção complementares:

### 1. `createTextNode()` em vez de `innerHTML` para texto da API

```javascript
// ❌ Vulnerável — executa HTML da API
bubble.innerHTML += text;

// ✅ Seguro — texto é tratado como texto puro
bubble.appendChild(document.createTextNode(text));
```

### 2. Parser manual de Markdown via DOM API

Links e blocos de código são renderizados através de funções que constroem elementos DOM programaticamente (`createElement`, `createTextNode`, `setAttribute`), nunca injectando strings HTML directamente.

### 3. Content Security Policy no `<meta>` do HTML

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               style-src {cssUri} 'unsafe-inline';
               script-src {scriptUri} 'unsafe-inline';
               img-src data: {logoUri};
               connect-src https://api.tess.im;">
```

A CSP bloqueia qualquer script não declarado explicitamente, mesmo que seja injectado via `innerHTML`.

## Alternativas rejeitadas

- **Sanitização com biblioteca (DOMPurify):** Adicionaria uma dependência de runtime ao webview. As três camadas acima são suficientes para o caso de uso.
- **Confiar no conteúdo da API Tess:** Inaceitável por princípio — a extensão não deve assumir que o conteúdo de qualquer API externa é seguro para renderização HTML.

## Consequências

- Links nas respostas do agente são clicáveis (gerados com `createElement('a')`) e seguros.
- Blocos de código são renderizados com syntax highlighting básico via DOM, sem `innerHTML`.
- Nenhum conteúdo recebido da API é executado como HTML.
- A CSP é aplicada mesmo que um bug futuro introduza `innerHTML` algures — funciona como rede de segurança.
