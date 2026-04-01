'use strict';

/**
 * Gera o HTML completo do WebView.
 *
 * @param {import('vscode').Uri} logoUri    - URI do logótipo SVG
 * @param {import('vscode').Uri} cssUri     - URI do webview.css
 * @param {import('vscode').Uri} scriptUri  - URI do webview-script.js
 * @param {Array<{id:string, label:string}>} models - Lista de modelos para o <select>
 * @param {Object} modelLimits - Mapa modelId → limite de tokens
 * @returns {string} HTML completo
 */
function buildHtml(logoUri, cssUri, scriptUri, models, modelLimits) {
    const modelOptions = models
        .map(m => `<option value="${m.id}">${m.label}</option>`)
        .join('');

    // Passa os limites de contexto para o script do WebView como variável global
    const limitsJson = JSON.stringify(modelLimits);

    return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src 'unsafe-inline' https://*.vscode-cdn.net;
                 script-src 'unsafe-inline' https://*.vscode-cdn.net;
                 img-src data: https://*.vscode-cdn.net;
                 connect-src https://api.tess.im;">
  <title>Tess AI</title>
  <link rel="stylesheet" href="${cssUri}">
</head>
<body>

  <!-- ── Toolbar ─────────────────────────────────────────────────────────── -->
  <div id="toolbar">
    <div id="modelRow">
      <label>Modelo:</label>
      <select id="modelSelect">${modelOptions}</select>
    </div>
    <button class="btn-ghost" id="clearBtn">Limpar</button>
  </div>

  <!-- ── Área de mensagens ────────────────────────────────────────────────── -->
  <div id="messages">
    <div id="watermark">
      <img src="${logoUri}" alt="TIS">
    </div>
    <div id="empty">
      Olá! Como posso ajudar?<br>
      <small>O código do editor activo é incluído automaticamente.</small>
    </div>
  </div>

  <!-- ── Input ────────────────────────────────────────────────────────────── -->
  <div id="inputArea">
    <div id="actionButtons">
      <button class="btn-ghost" id="codeBtn">📎 Adicionar ficheiros</button>
      <button class="btn-ghost" id="contextBtn">🗂️ Contexto do projecto</button>
    </div>
    <div id="inputRow">
      <textarea
        id="userInput"
        placeholder="Escreva aqui... (Enter envia, Shift+Enter nova linha)"
        rows="1"
      ></textarea>
      <button id="sendBtn">Enviar</button>
    </div>
    <div id="contextStatus">
      <div id="contextBar"><div id="contextFill"></div></div>
      <span id="contextLabel">contexto: 0 tok</span>
    </div>
    <div id="hint">Enter para enviar · Shift+Enter para nova linha</div>
  </div>

  <!-- ── Variáveis globais para o script ──────────────────────────────────── -->
  <script>window.MODEL_LIMITS = ${limitsJson};</script>

  <!-- ── Script principal ─────────────────────────────────────────────────── -->
  <script src="${scriptUri}"></script>

</body>
</html>`;
}

module.exports = { buildHtml };