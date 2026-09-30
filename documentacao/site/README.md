# Portal de documentação F2E

Abra [index.html](../index.html) diretamente no navegador. Não é necessário
servidor, internet, Node.js ou instalação de pacotes para usar o site.

O portal reúne os documentos completos de requisitos e restrições,
arquitetura, blueprint arquitetural e os cinco relatórios de benchmark.
Inclui busca global sem distinção de acentos, seções recolhíveis, componentes
de arquitetura clicáveis, gráficos da matriz AWS, abas por contexto e
exportação CSV. No campo de busca, use `/` para focar e `Esc` para limpar.

## Atualizar o conteúdo

Na raiz do repositório, usando Git Bash:

```bash
python documentacao/site/gerar_site.py
```

O gerador usa apenas a biblioteca padrão do Python 3. Ele lê os oito
documentos Markdown, extrai a tabela da matriz AWS e incorpora os resultados
locais preservados em `dados/` no HTML. O arquivo `documentacao/index.html`
gerado deve ser versionado junto com as alterações das fontes.

- `template.html`: estrutura das páginas e sínteses editoriais.
- `diagrama.html`: componentes da arquitetura interativa.
- `site.css`: apresentação responsiva.
- `site.js`: navegação, busca, detalhes, gráficos e CSV.
- `gerar_site.py`: conversão do subconjunto Markdown usado pelos documentos
  (títulos, parágrafos, listas, tabelas, links, citações e blocos de código).
- `dados/`: cópias dos relatórios locais usados pelo painel.

Ao alterar conclusões, configurações ou execuções de referência, revise também
as sínteses do template e os detalhes dos componentes em `site.js`. O gerador
preserva o código Mermaid do documento original em uma seção recolhível; a
topologia interativa é implementada localmente, sem dependência de CDN.

## Publicar no GitHub Pages

O workflow [pages.yml](../../.github/workflows/pages.yml) gera e publica o
portal quando há alterações em `documentacao/` na branch `master`. Pull
requests apenas geram o artefato, sem publicar. Também é possível executar
o workflow manualmente em **Actions → GitHub Pages → Run workflow**.

No repositório, selecione **Settings → Pages → Build and deployment →
Source → GitHub Actions**. Depois de enviar as alterações para `master` e
concluir o workflow, o endereço esperado é <https://matosoe.github.io/f2e/>.

Para gerar e visualizar a versão de publicação localmente, na raiz:

```bash
python documentacao/site/gerar_site.py --pages-dir .build/pages
python -m http.server 8000 --directory .build
```

Abra <http://localhost:8000/pages/>. Esse prefixo também permite conferir
os caminhos relativos usados em um site de projeto como `/f2e/`.
A pasta `.build/pages/` contém o HTML, CSS, JavaScript, os dois JSONs de
evidências e `.nojekyll`. Links para Markdown e scripts apontam para o
GitHub; o workflow usa o commit publicado para manter as referências estáveis.
Em forks, a URL do repositório é obtida automaticamente pelo workflow.
Se mudar a branch de publicação, ajuste os filtros `master` no workflow.

A geração sem `--pages-dir` continua atualizando `documentacao/index.html`
para uso offline. A geração para Pages não altera esse arquivo versionado.
Não é necessário configurar domínio próprio, Node.js ou dependências Python.

## Proveniência dos resultados

| Painel | Fonte |
|---|---|
| Matriz AWS, 09/09/2026 | Tabela versionada em `benchmark/benchmark-aws-memory-matrix.md`, execução `20260909T123015Z`. O JSON bruto citado não estava disponível no checkout usado para criar o portal. |
| Baseline AWS e P3, 08/09/2026 | `benchmark/benchmark-aws-5m.md` e `benchmark/p3-right-sizing-memoria.md`. |
| Local, 07/09/2026 | Cópia integral de `automacao/resultados/benchmark-local-5m/20260907T211528Z/report.json` em `dados/local-5m-20260907T211528Z.json`. |
| Matriz local, 08/09/2026 | Cópia integral de `automacao/resultados/benchmark-local-memory-matrix/20260908T234320Z/summary.json` em `dados/matriz-local-20260908T234320Z.json`. |

As cópias locais permitem compartilhar o portal sem depender da pasta de
resultados, que é ignorada pelo Git. A matriz local não tem carga completa
registrada para 256 MiB; os outros três perfis completos falharam. O painel não
trata vazões parciais como resultados válidos de 5 milhões.

O tempo de processamento local é separado do upload; o tempo AWS apresentado
é ponta a ponta. Os perfis históricos e a matriz AWS usam configurações
diferentes. Nenhum benchmark novo é executado pelo site ou pelo gerador.

## Verificação

Após regenerar, abra `index.html` e confira navegação, busca (por exemplo,
“idempotencia”), componentes da arquitetura, seleção de métricas/perfis,
abas dos benchmarks e download CSV. Verifique também em largura móvel.
