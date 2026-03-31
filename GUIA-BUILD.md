# Guia de Build — Tess Tis

## Processo completo (versão nova)

```bash
# 1. Actualizar a versão (MAJOR.MINOR.PATCH — ver tabela abaixo)
npm version 2.X.X --no-git-tag-version

# 2. Gerar o .vsix
npx vsce package

# 3. Remover versões antigas instaladas e instalar a nova
rm -rf "$USERPROFILE/.vscode/extensions/tis-angola.tess-tis-"*
code --install-extension tess-tis-2.X.X.vsix --force

# 4. Recarregar o VS Code
# CTRL+SHIFT+P → Developer: Reload Window
```

> **Nota:** O VS Code não substitui versões antigas automaticamente ao instalar via VSIX —
> adiciona uma nova pasta lado a lado. Sem o passo 3, acumulam-se versões em conflito
> e o ícone de reload fica persistente.

---

## Semantic Versioning — MAJOR.MINOR.PATCH

| Posição   | Nome           | Quando incrementar                                              |
|-----------|----------------|-----------------------------------------------------------------|
| 1 (Major) | Ruptura        | API ou comportamento muda de forma incompatível                 |
| 2 (Minor) | Funcionalidade | Adicionas algo novo que não quebra nada existente               |
| 3 (Patch) | Correcção      | Corrigiste um bug sem adicionar funcionalidade                  |

---

## Instalação alternativa (sem terminal)

- **CTRL+SHIFT+P → Extensions: Install from VSIX** — selecciona o ficheiro `.vsix`
- Depois **CTRL+SHIFT+P → Developer: Reload Window**

---

## Avisos normais do vsce (podem ser ignorados)

```
WARNING  A 'repository' field is missing from the 'package.json' manifest file.
WARNING  LICENSE.md, LICENSE.txt or LICENSE not found
```
