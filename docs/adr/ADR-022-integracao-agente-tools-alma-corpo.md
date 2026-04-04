
### Manutenção dos dois artefactos

`TESS-TOOLS-KNOWLEDGE-BASE.md` e `getToolsSystemPrompt()` são **artefactos derivados**
de `src/tools.js`. Qualquer alteração às ferramentas (novo tool, novo argumento, mudança
de protocolo) exige actualização dos dois.

---

## Alternativas rejeitadas

**Apenas system prompt detalhado (situação anterior)**
O system prompt com toda a documentação era longo e misturava referência com instrução.
Modelos tendem a seguir padrões de treino quando o prompt é longo e não directivo.
Rejeitado: demonstrou falhar em produção.

**Apenas base de conhecimento sem system prompt**
A base de conhecimento fornece contexto mas não instrução comportamental. O modelo
pode ler a documentação e ainda assim usar um formato diferente por inércia de treino.
Rejeitado: não resolve o problema de sobreposição de padrões de treino.

**Detecção de formatos alternativos no webview**
Adicionar regex para `<file_read>`, `<tool_call>`, etc. no `finalizeAssistant()`.
Rejeitado: é uma solução de remediação que esconde o problema em vez de o resolver;
prolifera com cada novo modelo e aumenta a complexidade do parser.

**Function calling formal**
A API Tess não suporta o campo `tools` no body do pedido (ver ADR-013).
Rejeitado: fora do controlo desta extensão.

---

## Consequências

- O agente passa a ter contexto de referência (base de conhecimento) separado do
  contexto de instrução (system prompt) — princípio de responsabilidade única aplicado
  ao prompting.
- O system prompt fica mais curto e mais assertivo, o que aumenta a probabilidade
  de seguimento pelo modelo.
- A manutenção passa a exigir actualização de dois ficheiros quando `tools.js` muda —
  documentado como requisito explícito neste ADR e no próprio `TESS-TOOLS-KNOWLEDGE-BASE.md`.
- Se um modelo futuro continuar a falhar o formato, o próximo passo de investigação
  está delimitado: verificar se a base de conhecimento está a ser injectada correctamente
  antes do system prompt, e se o system prompt está a reforçar a proibição de formatos alternativos.
- A metáfora "alma e corpo" documenta a dependência crítica: o LLM (alma) sem acesso
  fiável ao filesystem (corpo) perde a capacidade de actuar — a extensão torna-se apenas
  um chat com contexto de ficheiro, não um agente de código.

AGENTE TIS-TESS esteve aqui e editou este documento
