# ADR-013 — Protocolo de Tool Calling via tags de texto

**Estado:** Aceite
**Data:** 2026-04-01

## Contexto

Para dar ao agente Tess acesso ao filesystem do projecto (ler ficheiros, listar estrutura, escrever ficheiros), é necessário um mecanismo de tool calling. A API Tess não suporta function calling formal no formato OpenAI (campo `tools` no body do pedido).

## Decisão

Protocolo baseado em tags de texto inseridas pelo agente na sua resposta:

```
[TOOL:get_tree]
[TOOL:get_file:src/extension.js]
[TOOL:list_dir:src]
[TOOL:write_file:caminho/ficheiro.js:conteudo completo]
```

**Fluxo de execução:**

1. O agente inclui uma ou mais tags `[TOOL:...]` na resposta
2. `finalizeAssistant()` no WebView detecta todas as tags com regex ao receber `endResponse`
3. As tags são removidas do texto visível; para cada tag, o WebView:
   - Chama `appendToolNotice()` — mostra aviso descritivo no chat imediatamente
   - Envia `{ type: 'toolCall', tool, args, content }` para o provider
4. `provider.js` delega para `executeTool()` em `tools.js` (com `try/catch` garantindo resposta)
5. Cada resultado chega ao WebView como `{ type: 'toolResult', tool, args, result }`
6. O WebView **acumula** todos os resultados num array (`_toolResults`) e só envia à API quando **todos** chegaram — um único `send()` com os resultados combinados
7. O agente recebe todos os resultados numa mensagem coerente e continua a resposta

**Nota:** A mudança do passo 6 (acumulação vs. envio imediato) é crítica — sem ela, N tools geram N streams paralelos, causando estados incoerentes. Ver ADR-023 para a queue de resultados e ADR-024 para o watchdog de segurança.

**Ferramentas disponíveis:**

| Tag | Descrição |
|-----|-----------|
| `[TOOL:get_tree]` | Estrutura completa do projecto |
| `[TOOL:get_file:caminho]` | Conteúdo de um ficheiro |
| `[TOOL:list_dir:caminho]` | Conteúdo de uma directoria |
| `[TOOL:write_file:caminho]` | Criar ficheiro novo (pede confirmação; conteúdo no bloco de código anterior) |
| `[TOOL:edit_file:caminho]` | Editar ficheiro existente (pede confirmação; conteúdo no bloco de código anterior) |

## Alternativas rejeitadas

- **Function calling OpenAI formal:** A API Tess não suporta o campo `tools` no body do pedido ao endpoint `/openai/chat/completions`.
- **Detecção no lado Node.js (api.js):** Criaria duplicação — o WebView já recebe o stream chunk a chunk e é o lugar natural para finalizar e interpretar a resposta completa. A detecção foi mantida exclusivamente em `finalizeAssistant()` no webview-script.
- **Endpoint separado de ferramentas:** Aumentaria a complexidade sem ganho funcional.

## Consequências

- O system prompt do agente Tess precisa de documentar o protocolo de tags para que o modelo o use correctamente — ver `getToolsSystemPrompt()` em `tools.js`.
- `write_file` e `edit_file` requerem confirmação explícita do utilizador via modal VS Code (`showWarningMessage`) antes de escrever qualquer ficheiro.
- Ficheiros acima de 50 000 caracteres são truncados com aviso para proteger o contexto.
- O utilizador vê notificações visuais persistentes (`appendToolNotice`) para cada ferramenta, antes da execução.
- O protocolo é frágil se o modelo gerar as tags com formatação incorrecta — mitigado pelo system prompt detalhado.
- O mecanismo de detecção de dessincronia (ADR-024) protege o utilizador quando o fluxo de tool calls é interrompido inesperadamente.
