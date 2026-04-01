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
            const retryAfter = parseInt(error.response.headers['retry-after'] ?? '5', 10);
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

    if (!isToolContinuation && userText && !userText.includes('