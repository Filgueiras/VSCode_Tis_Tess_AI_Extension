// src/api.js
'use strict';

const axios = require('axios');

const BASE_URL         = 'https://api.tess.im';
const REQUEST_TIMEOUT  = 300_000; // 5 min
const FIRST_BYTE_LIMIT =  30_000; // 30s até ao primeiro chunk
const INACTIVITY_LIMIT =  60_000; // 60s sem dados após stream iniciado

let _abortController = null;

// ─── Cancel ──────────────────────────────────────────────────────────────────

function cancelStream() {
    _abortController?.abort();
    _abortController = null;
}

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

// ─── Retry no 429 ────────────────────────────────────────────────────────────

async function postWithRetry(url, body, headers, signal) {
    const cfg = { headers, responseType: 'stream', timeout: REQUEST_TIMEOUT, signal };
    try {
        return await axios.post(url, body, cfg);
    } catch (err) {
        if (err.response?.status === 429) {
            const wait = parseInt(err.response.headers['retry-after'] ?? '5', 10);
            console.warn(`[Tess:api] Rate limit. Aguardando ${wait}s...`);
            await new Promise(r => setTimeout(r, wait * 1000));
            return await axios.post(url, body, cfg);
        }
        throw err;
    }
}

// ─── Mensagens de erro amigáveis ──────────────────────────────────────────────

function friendlyError(status, fallback) {
    switch (status) {
        case 401: return 'API Key inválida ou expirada. Verifique em Definições → tess.apiKey.';
        case 403: return 'Sem permissão para aceder a este agente. Verifique se o Agent ID está correcto.';
        case 404: return 'Agente não encontrado. Verifique se o Agent ID existe e está acessível.';
        case 500: return 'Erro interno do servidor Tess. Tente novamente em alguns segundos.';
        case 502: return 'Servidor Tess inacessível (bad gateway). Verifique tess.im/status.';
        case 503: return 'Serviço Tess temporariamente indisponível. Verifique tess.im/status.';
        case 504: return 'O servidor Tess não respondeu a tempo (504). Tente com menos contexto ou aguarde.';
        case 524: return 'Timeout do Cloudflare (524) — o servidor demorou demasiado. Tente com menos contexto ou aguarde.';
        default:  return fallback ? `Erro ${status}: ${fallback}` : `Erro de ligação (${status}).`;
    }
}

// ─── Stream principal ─────────────────────────────────────────────────────────

/**
 * @param {{
 *   apiKey:   string,
 *   agentId:  string,
 *   model:    string,
 *   messages: {role: string, content: string}[],
 *   onChunk:  (text: string) => void,
 *   onUsage:  (usage: object) => void,
 *   onEnd:    () => void,
 *   onError:  (msg: string) => void
 * }} opts
 */
async function startStream({ apiKey, agentId, model, messages, onChunk, onUsage, onEnd, onError }) {
    // Garante que não há stream anterior activo
    cancelStream();
    _abortController = new AbortController();
    const signal = _abortController.signal;

    const body = { messages, stream: true };
    if (model && model !== 'auto') body.model = model;

    console.log(`[Tess] → POST ${BASE_URL}/agents/${agentId}/openai/chat/completions (model: ${model})`);

    try {
        const response = await postWithRetry(
            `${BASE_URL}/agents/${agentId}/openai/chat/completions`,
            body,
            {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type':  'application/json'
            },
            signal
        );

        await new Promise((resolve) => {
            let buffer        = '';
            let receivedChunk = false;
            let doneSent      = false;

            // ── Watchdog: primeiro chunk ──────────────────────────────────
            const firstByteTimer = setTimeout(() => {
                if (!receivedChunk) {
                    console.warn('[Tess] Timeout: sem resposta em 30s');
                    response.data.destroy();
                    onError('O modelo demorou demasiado a responder. Tente novamente.');
                    resolve();
                }
            }, FIRST_BYTE_LIMIT);

            // ── Watchdog: inactividade após stream iniciado ───────────────
            let inactivityTimer = null;
            function resetInactivity() {
                clearTimeout(inactivityTimer);
                inactivityTimer = setTimeout(() => {
                    if (!doneSent) {
                        console.warn('[Tess] Timeout de inactividade');
                        response.data.destroy();
                        onError('A resposta parou a meio sem terminar. Tente novamente.');
                        resolve();
                    }
                }, INACTIVITY_LIMIT);
            }

            function finish() {
                if (doneSent) return;
                doneSent = true;
                clearTimeout(firstByteTimer);
                clearTimeout(inactivityTimer);
                onEnd();
                resolve();
            }

            response.data.on('data', (chunk) => {
                receivedChunk = true;
                resetInactivity();
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop(); // retém linha incompleta

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const raw = line.slice(6).trim();
                    if (raw === '[DONE]') { finish(); return; }
                    try {
                        const parsed = JSON.parse(raw);
                        const text   = parsed.choices?.[0]?.delta?.content;
                        if (text) onChunk(text);
                        if (parsed.usage) onUsage(parsed.usage);
                    } catch { /* chunk incompleto */ }
                }
            });

            response.data.on('end', () => {
                if (buffer.startsWith('data: ')) {
                    const raw = buffer.slice(6).trim();
                    if (raw && raw !== '[DONE]') {
                        try {
                            const text = JSON.parse(raw).choices?.[0]?.delta?.content;
                            if (text) onChunk(text);
                        } catch { /* ignorar */ }
                    }
                }
                finish();
            });

            response.data.on('error', (err) => {
                clearTimeout(firstByteTimer);
                clearTimeout(inactivityTimer);
                console.error('[Tess] Erro de stream:', err.message);
                onError(`Erro de ligação: ${err.message}`);
                resolve();
            });
        });

    } catch (err) {
        console.error('[Tess] Erro na chamada:', err.message, '| status:', err.response?.status);

        if (axios.isCancel(err) || err.name === 'CanceledError' || err.name === 'AbortError') {
            return; // cancelamento normal — provider envia 'cancelled' se necessário
        }

        const status = err.response?.status;
        if (status) {
            const apiMsg = err.response.data
                ? await readErrorBody(err.response.data) ?? null
                : null;
            onError(friendlyError(status, apiMsg));
        } else {
            onError(`Sem ligação ou serviço inacessível: ${err.message}`);
        }
    } finally {
        _abortController = null;
    }
}

module.exports = { startStream, cancelStream };
