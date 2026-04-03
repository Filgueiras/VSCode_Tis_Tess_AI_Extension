'use strict';

function buildHtml(logoUri, cssUri, scriptUri, models, modelLimits, cspSource, nonce) {
    const modelOptions = models
        .map(m => `<option value="${m.id}">${m.label}</option>`)
        .join('');

    const limitsJson = JSON.stringify(modelLimits);

    return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${cspSource} 'unsafe-inline';
                 script-src ${cspSource} 'nonce-${nonce}';
                 img-src ${cspSource} data:;
                 connect-src https://api.tess.im https://tess.im;">
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
    <button class="btn-ghost" id="historyBtn">Histórico</button>
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

  <!-- ── Variáveis globais ─────────────────────────────────────────────────── -->
  <script nonce="${nonce}">window.MODEL_LIMITS = ${limitsJson};</script>

  <!-- ── Script principal ─────────────────────────────────────────────────── -->
  <script nonce="${nonce}" src="${scriptUri}"></script>

</body>
</html>`;
}

module.exports = { buildHtml };
