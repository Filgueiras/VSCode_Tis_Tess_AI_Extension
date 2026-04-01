// c:\Developer\VS_Code_Tess_Extension\src\api.js
'use strict';

const vscode  = require('vscode');
const axios   = require('axios');
const { getWorkspaceTree, getCurrentCode } = require('./workspace');

const BASE_URL        = 'https://api.tess.im';
const REQUEST_TIMEOUT = 300000;

// ─── Leitura do corpo de erro ─────────────────────────────────────────────────

async function readErrorBody(data) {
    if (typeof data?.pipe !== 'function') {
        console.error('[Tess:api] Erro API:', JSON.stringify(data));
        return data?.message || data?.error || data?.detail || null;
    }
    const chunks = [];
    await new Promise((res, rej) => {
        data.on('data', c => chunks.push(c));
        data.on('end', res);
        data.on('error', rej);
    });
    try {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        console.error('[Tess:api] Erro API:', JSON.stringify(body));
        return body.message || body.error || body.detail || null;
    } catch {
        return null;
    }
}

// ─── Envio com retry no 429 ───────────────────────────────────────────────────

async function postWithRetry(url, body, headers, signal) {
    try {
        return await axios.post(url, body, {
            headers,
            responseType: 'stream',
            timeout: REQUEST_TIMEOUT,
            signal
        });
    } catch (error) {
        if (error.response?.status === 429) {
            const retryAfter = Number.parseInt(error.response.headers['retry-after'] ?? '5', 10);
            console.warn(`[Tess:api] Rate limit atingido. Aguardando ${retryAfter}s...`);
            await new Promise(res => setTimeout(res, retryAfter * 1000));
            return await axios.post(url, body, {
                headers,
                responseType: 'stream',
                timeout: REQUEST_TIMEOUT,
                signal
            });
        }
        throw error;
    }
}

// ─── Handler principal ────────────────────────────────────────────────────────

/**
 * Envia uma mensagem para a API Tess e faz stream da resposta para o WebView.
 * @returns {Promise<string|null>} Texto completo da resposta do assistente, ou null em caso de erro/cancelamento
 */
async function handleSend(view, userText, model, history, signal, lastEditor, isToolContinuation = false) {
    const config  = vscode.workspace.getConfiguration('tess');
    const apiKey  = config.get('apiKey');
    const agentId = config.get('agentId');

    if (!apiKey) {
        view.webview.postMessage({ type: 'error', text: 'API Key não configurada. Vá a Definições → tess.apiKey' });
        return null;
    }
    if (!agentId) {
        view.webview.postMessage({ type: 'error', text: 'Agent ID não configurado. Vá a Definições → tess.agentId' });
        return null;
    }

    let fullUserText = userText;

    if (!isToolContinuation && userText) {
        // Inclui o código do editor activo como contexto
        const codeInfo = getCurrentCode(lastEditor);
        if (codeInfo) {
            fullUserText = `${userText}\n\n\`\`\`${codeInfo.language}\n${codeInfo.code}\n\`\`\``;
        }

        // Na primeira mensagem da conversa, injecta silenciosamente a árvore do workspace
        if (history.length === 0) {
            const tree = await getWorkspaceTree();
            if (tree) fullUserText = `${tree}\n\n---\n\n${fullUserText}`;
        }
    }

    const messages = [
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: fullUserText || userText }
    ];

    const body = { messages, stream: true };
    if (model !== 'auto') body.model = model;

    try {
        console.log(`[Tess] → POST ${BASE_URL}/agents/${agentId}/openai/chat/completions (model: ${model})`);
        view.webview.postMessage({ type: 'startResponse' });

        const response = await postWithRetry(
            `${BASE_URL}/agents/${agentId}/openai/chat/completions`,
            body,
            {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            signal
        );

        return await new Promise((resolve) => {
            let buffer   = '';
            let fullText = '';

            response.data.on('data', (chunk) => {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const raw = line.slice(6).trim();
                    if (raw === '[DONE]') {
                        view.webview.postMessage({ type: 'endResponse' });
                        resolve(fullText || null);
                        return;
                    }
                    try {
                        const parsed = JSON.parse(raw);
                        const text   = parsed.choices?.[0]?.delta?.content;
                        if (text) {
                            fullText += text;
                            view.webview.postMessage({ type: 'chunk', text });
                        }
                        if (parsed.usage) {
                            view.webview.postMessage({ type: 'usage', usage: parsed.usage });
                        }
                    } catch { /* chunk incompleto */ }
                }
            });

            response.data.on('end', () => {
                view.webview.postMessage({ type: 'endResponse' });
                resolve(fullText || null);
            });

            response.data.on('error', (err) => {
                console.error('[Tess] Erro de stream:', err.message);
                view.webview.postMessage({ type: 'error', text: `Erro de ligação: ${err.message}` });
                resolve(null);
            });
        });

    } catch (error) {
        console.error('[Tess] Erro na chamada:', error.message, '| code:', error.code, '| status:', error.response?.status);

        if (axios.isCancel(error) || error.name === 'CanceledError' || error.name === 'AbortError') {
            view.webview.postMessage({ type: 'cancelled' });
            return null;
        }

        let msg = error.message;
        if (error.response?.data) {
            try {
                msg = await readErrorBody(error.response.data) ?? msg;
            } catch (e) {
                console.error('[Tess] Falha ao ler erro:', e.message);
            }
        }

        view.webview.postMessage({ type: 'error', text: `Erro: ${msg}` });
        return null;
    }
}

module.exports = { handleSend };
