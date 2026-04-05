// src/tisai.js
'use strict';

const axios = require('axios');

const BASE_URL         = 'https://ai.tisdev.cloud/api/v1';
const REQUEST_TIMEOUT  = 300_000; // 5 min
const FIRST_BYTE_LIMIT =  30_000; // 30s até ao primeiro chunk
const INACTIVITY_LIMIT =  60_000; // 60s sem dados após stream iniciado

let _abortController = null;

// ─── Cancel ──────────────────────────────────────────────────────────────────

function cancelTisAiStream() {
    _abortController?.abort();
    _abortController = null;
}

// ─── Leitura do corpo de erro ─────────────────────────────────────────────────

async function readErrorBody(data) {
    if (typeof data?.pipe !== 'function') {
        console.error('[TisAI:api] Erro API:', JSON.stringify(data));
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
        console.error('[TisAI:api] Erro API:', JSON.stringify(body));
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
            const wait = Number.parseInt(err.response.headers['retry-after'] ?? '5', 10);
            console.warn(`[TisAI:api] Rate limit. Aguardando ${wait}s...`);
            await new Promise(r => setTimeout(r, wait * 1000));
            return await axios.post(url, body, cfg);
        }
        throw err;
    }
}

// ─── Mensagens de erro amigáveis ──────────────────────────────────────────────

function friendlyError(status, fallback) {
    switch (status) {
        case 401: return 'API Key TIS.ia inválida ou expirada. Verifique em Definições → tis.tisAiApiKey.';
        case 403: return 'Sem permissão. Verifique a sua chave TIS.ai e o assistente configurado.';
        case 404: return 'Assistente não encontrado. Verifique o ID do assistente TIS.ai.';
        case 500: return 'Erro interno do servidor TIS.ai. Tente novamente em alguns segundos.';
        case 502: return 'Servidor TIS.ai inacessível (bad gateway).';
        case 503: return 'Serviço TIS.ai temporariamente indisponível.';
        case 504: return 'O servidor TIS.ai não respondeu a tempo. Tente com menos contexto ou aguarde.';
        default:  return fallback ? `Erro ${status}: ${fallback}` : `Erro de ligação TIS.ai (${status}).`;
    }
}

// ─── Parser de chunk SSE ──────────────────────────────────────────────────────
// A TisAI usa o formato OpenAI (choices[0].delta.content) ou texto simples.
// Tenta JSON primeiro; se falhar, trata como texto puro.

function parseChunk(raw) {
    if (!raw || raw === '[DONE]') return { done: raw === '[DONE]', text: null, usage: null };
    try {
        const parsed = JSON.parse(raw);
        const text   = parsed.choices?.[0]?.delta?.content ?? null;
        const usage  = parsed.usage ?? null;
        return { done: false, text, usage };
    } catch {
        // texto simples (não JSON)
        return { done: false, text: raw, usage: null };
    }
}

// ─── Stream principal ─────────────────────────────────────────────────────────

/**
 * @param {{
 *   apiKey:      string,
 *   assistantId: string|null,
 *   model:       string,
 *   messages:    {role: string, content: string}[],
 *   onChunk:     (text: string) => void,
 *   onUsage:     (usage: object) => void,
 *   onEnd:       () => void,
 *   onError:     (msg: string) => void
 * }} opts
 */
async function startTisAiStream({ apiKey, assistantId, model, messages, onChunk, onUsage, onEnd, onError }) {
    cancelTisAiStream();
    _abortController = new AbortController();
    const signal = _abortController.signal;

    const body = { messages, stream: true };
    if (model && model !== 'auto') body.model = model;
    if (assistantId)               body.assistant_id = Number.parseInt(assistantId, 10) || assistantId;

    console.log(`[TisAI] → POST ${BASE_URL}/chat/completions (model: ${model}, assistant: ${assistantId ?? 'none'})`);

    try {
        const response = await postWithRetry(
            `${BASE_URL}/chat/completions`,
            body,
            {
                'X-API-Key':    apiKey,
                'Content-Type': 'application/json'
            },
            signal
        );

        await new Promise((resolve) => {
            let buffer        = '';
            let receivedChunk = false;
            let doneSent      = false;

            const firstByteTimer = setTimeout(() => {
                if (!receivedChunk) {
                    console.warn('[TIS.ai] Timeout: sem resposta em 30s');
                    response.data.destroy();
                    onError('O modelo TIS.ai demorou demasiado a responder. Tente novamente.');
                    resolve();
                }
            }, FIRST_BYTE_LIMIT);

            let inactivityTimer = null;
            function resetInactivity() {
                clearTimeout(inactivityTimer);
                inactivityTimer = setTimeout(() => {
                    if (!doneSent) {
                        console.warn('[TIS.ai] Timeout de inactividade');
                        response.data.destroy();
                        onError('A resposta TIS.ai parou a meio sem terminar. Tente novamente.');
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
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const raw = line.slice(6).trim();
                    const { done, text, usage } = parseChunk(raw);
                    if (done) { finish(); return; }
                    if (text)  onChunk(text);
                    if (usage) onUsage(usage);
                }
            });

            response.data.on('end', () => {
                if (buffer.startsWith('data: ')) {
                    const raw = buffer.slice(6).trim();
                    const { done, text } = parseChunk(raw);
                    if (!done && text) onChunk(text);
                }
                finish();
            });

            response.data.on('error', (err) => {
                clearTimeout(firstByteTimer);
                clearTimeout(inactivityTimer);
                console.error('[TIS.ai] Erro de stream:', err.message);
                onError(`Erro de ligação TIS.ai: ${err.message}`);
                resolve();
            });
        });

    } catch (err) {
        console.error('[TIS.ai] Erro na chamada:', err.message, '| status:', err.response?.status);

        if (axios.isCancel(err) || err.name === 'CanceledError' || err.name === 'AbortError') {
            return;
        }

        const status = err.response?.status;
        if (status) {
            const apiMsg = err.response.data
                ? await readErrorBody(err.response.data) ?? null
                : null;
            onError(friendlyError(status, apiMsg));
        } else {
            onError(`Sem ligação TIS.ai ou serviço inacessível: ${err.message}`);
        }
    } finally {
        _abortController = null;
    }
}

// ─── Fetch de modelos disponíveis ─────────────────────────────────────────────

/**
 * Tenta obter a lista de modelos da API TisAI.
 * Experimenta GET /models (padrão OpenAI) e GET /assistants.
 * Em caso de falha devolve null para que o caller use a lista estática.
 *
 * @param {string} apiKey
 * @returns {Promise<Array<{id:string,label:string}>|null>}
 */
async function fetchTisAiModels(apiKey) {
    if (!apiKey) return null;

    // Tenta endpoint OpenAI-compatível /models
    try {
        const res = await axios.get(`${BASE_URL}/models`, {
            headers: { 'X-API-Key': apiKey },
            timeout: 8000
        });
        const data = res.data?.data ?? res.data ?? [];
        if (Array.isArray(data) && data.length > 0) {
            return data.map(m => ({
                id:    m.id ?? m.name,
                label: m.id ?? m.name
            })).filter(m => m.id);
        }
    } catch { /* endpoint pode não existir */ }

    // Tenta /assistants
    try {
        const res = await axios.get(`${BASE_URL}/assistants`, {
            headers: { 'X-API-Key': apiKey },
            timeout: 8000
        });
        const data = res.data?.data ?? res.data ?? [];
        if (Array.isArray(data) && data.length > 0) {
            return data.map(a => ({
                id:    String(a.id),
                label: a.name ?? a.title ?? String(a.id)
            })).filter(m => m.id);
        }
    } catch { /* endpoint pode não existir */ }

    return null; // fallback para lista estática
}

module.exports = { startTisAiStream, cancelTisAiStream, fetchTisAiModels };
