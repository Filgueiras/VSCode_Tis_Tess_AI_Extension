// src/openai-compat.js
// Cliente HTTP genérico para APIs compatíveis com o formato OpenAI chat completions.
// Usado por TisAI, Ollama e qualquer endpoint remoto SSE-streaming.
// A camada Tess usa api.js separado (autenticação Bearer + path /agents/{id}/...).
'use strict';

const axios = require('axios');

const REQUEST_TIMEOUT  = 300_000; // 5 min
const FIRST_BYTE_LIMIT =  30_000; // 30s até ao primeiro chunk
const INACTIVITY_LIMIT =  60_000; // 60s sem dados após stream iniciado

let _abortController = null;

// ─── Cancel ──────────────────────────────────────────────────────────────────

function cancelOpenAICompatStream() {
    _abortController?.abort();
    _abortController = null;
}

// ─── Leitura do corpo de erro ─────────────────────────────────────────────────

async function readErrorBody(data) {
    if (typeof data?.pipe !== 'function') {
        console.error('[OAICompat] Erro API:', JSON.stringify(data));
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
        console.error('[OAICompat] Erro API:', JSON.stringify(body));
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
            console.warn(`[OAICompat] Rate limit. Aguardando ${wait}s...`);
            await new Promise(r => setTimeout(r, wait * 1000));
            return await axios.post(url, body, cfg);
        }
        throw err;
    }
}

// ─── Mensagens de erro amigáveis ──────────────────────────────────────────────

function friendlyError(providerLabel, status, fallback) {
    switch (status) {
        case 401: return `API Key inválida ou expirada para ${providerLabel}.`;
        case 403: return `Sem permissão em ${providerLabel}. Verifique a chave e as permissões.`;
        case 404: return `Endpoint não encontrado em ${providerLabel}. Verifique a URL configurada.`;
        case 500: return `Erro interno do servidor ${providerLabel}. Tente novamente.`;
        case 502: return `${providerLabel} inacessível (bad gateway).`;
        case 503: return `${providerLabel} temporariamente indisponível.`;
        case 504: return `${providerLabel} não respondeu a tempo (504).`;
        default:  return fallback ? `Erro ${status} em ${providerLabel}: ${fallback}` : `Erro de ligação ${providerLabel} (${status}).`;
    }
}

// ─── Parser de chunk SSE ──────────────────────────────────────────────────────

function parseChunk(raw) {
    if (!raw || raw === '[DONE]') return { done: raw === '[DONE]', text: null, usage: null };
    try {
        const parsed = JSON.parse(raw);
        return {
            done:  false,
            text:  parsed.choices?.[0]?.delta?.content ?? null,
            usage: parsed.usage ?? null,
        };
    } catch {
        return { done: false, text: raw, usage: null }; // texto simples (não JSON)
    }
}

// ─── Stream principal ─────────────────────────────────────────────────────────

/**
 * @param {{
 *   providerLabel: string,
 *   baseUrl:       string,
 *   headers:       Record<string, string>,
 *   extraBody:     Record<string, unknown>,
 *   model:         string,
 *   messages:      {role: string, content: string}[],
 *   onChunk:       (text: string) => void,
 *   onUsage:       (usage: object) => void,
 *   onEnd:         () => void,
 *   onError:       (msg: string) => void
 * }} opts
 */
async function startOpenAICompatStream({
    providerLabel = 'API',
    baseUrl,
    headers = {},
    extraBody = {},
    model,
    messages,
    onChunk,
    onUsage,
    onEnd,
    onError,
}) {
    cancelOpenAICompatStream();
    _abortController = new AbortController();
    const signal = _abortController.signal;

    const body = { messages, stream: true, ...extraBody };
    if (model && model !== 'auto') body.model = model;

    const url = `${baseUrl}/chat/completions`;
    console.log(`[OAICompat] → POST ${url} (model: ${model ?? 'auto'}, provider: ${providerLabel})`);

    try {
        const response = await postWithRetry(url, body, {
            'Content-Type': 'application/json',
            ...headers,
        }, signal);

        await new Promise((resolve) => {
            let buffer        = '';
            let receivedChunk = false;
            let doneSent      = false;

            const firstByteTimer = setTimeout(() => {
                if (!receivedChunk) {
                    console.warn(`[OAICompat] Timeout: sem resposta de ${providerLabel} em 30s`);
                    response.data.destroy();
                    onError(`${providerLabel} demorou demasiado a responder. Tente novamente.`);
                    resolve();
                }
            }, FIRST_BYTE_LIMIT);

            let inactivityTimer = null;
            function resetInactivity() {
                clearTimeout(inactivityTimer);
                inactivityTimer = setTimeout(() => {
                    if (!doneSent) {
                        console.warn(`[OAICompat] Timeout de inactividade (${providerLabel})`);
                        response.data.destroy();
                        onError(`A resposta de ${providerLabel} parou a meio. Tente novamente.`);
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
                console.error(`[OAICompat] Erro de stream (${providerLabel}):`, err.message);
                onError(`Erro de ligação ${providerLabel}: ${err.message}`);
                resolve();
            });
        });

    } catch (err) {
        console.error(`[OAICompat] Erro na chamada (${providerLabel}):`, err.message);

        if (axios.isCancel(err) || err.name === 'CanceledError' || err.name === 'AbortError') {
            return;
        }

        const status = err.response?.status;
        if (status) {
            const apiMsg = err.response.data
                ? await readErrorBody(err.response.data) ?? null
                : null;
            onError(friendlyError(providerLabel, status, apiMsg));
        } else {
            onError(`Sem ligação com ${providerLabel}: ${err.message}`);
        }
    } finally {
        _abortController = null;
    }
}

module.exports = { startOpenAICompatStream, cancelOpenAICompatStream };
