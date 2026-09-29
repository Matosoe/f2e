#!/usr/bin/env python3
"""Gera o portal estático a partir dos documentos do repositório (sem dependências)."""
from pathlib import Path
import html
import json
import re

DOCS = Path(__file__).resolve().parent.parent
SITE = DOCS / "site"
FILES = [
    ("requisitos", "Requisitos e restrições", "requisitos_e_restricoes.md"),
    ("arquitetura", "Arquitetura", "arquitetura.md"),
    ("blueprint", "Blueprint arquitetural", "blueprint_arquitetural.md"),
    ("aws-matriz", "AWS · matriz de memória", "benchmark/benchmark-aws-memory-matrix.md"),
    ("aws-inicial", "AWS · execução inicial", "benchmark/benchmark-aws-5m.md"),
    ("local", "Local · 5 milhões", "benchmark/benchmark-local-5m.md"),
    ("local-matriz", "Local · matriz de memória", "benchmark/benchmark-local-memory-matrix.md"),
    ("p3", "Histórico · investigação P3", "benchmark/p3-right-sizing-memoria.md"),
]
ROUTES = {path: ident for ident, _, path in FILES}
def esc(text):
    return html.escape(str(text), quote=True)

def inline(text, source):
    tokens = []
    def hold(value):
        tokens.append(value)
        return f"\x00{len(tokens)-1}\x00"
    text = re.sub(r"`([^`]+)`", lambda m: hold("<code>"+esc(m[1])+"</code>"), text)
    def link(m):
        url = m[2]
        if not re.match(r"^(https?://|#)", url):
            path, _, fragment = url.partition("#")
            resolved = (DOCS / source).parent.joinpath(path).resolve()
            try:
                relative = resolved.relative_to(DOCS).as_posix()
                url = "#"+ROUTES[relative] if relative in ROUTES else relative+("#"+fragment if fragment else "")
            except ValueError:
                url = "../"+resolved.relative_to(DOCS.parent).as_posix()
        if re.match(r"^[a-zA-Z]+:", url) and not url.startswith(("https://", "http://")):
            return hold(esc(m[1]))
        return hold('<a href="'+esc(url)+'">'+esc(m[1])+'</a>')
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", link, text)
    text = esc(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", text)
    return re.sub(r"\x00(\d+)\x00", lambda m: tokens[int(m[1])], text)

def markdown(text, source, ident):
    lines = text.replace("\r", "").splitlines()
    out, i, section, count = [], 0, False, 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        fence = re.match(r"^(`{3,}|~{3,})(.*)", line)
        if fence:
            code, i = [], i+1
            while i < len(lines) and not lines[i].strip().startswith(fence[1]):
                code.append(lines[i]); i += 1
            block = '<pre><code>'+esc("\n".join(code))+'</code></pre>'
            if fence[2].strip() == "mermaid":
                block = '<details class="diagram-source"><summary>Código do diagrama original (Mermaid)</summary>'+block+'</details>'
            out.append(block); i += 1; continue
        heading = re.match(r"^(#{1,6})\s+(.+)", line)
        if heading:
            level, title = len(heading[1]), heading[2]
            if level == 1:
                i += 1; continue
            if level == 2:
                if section: out.append("</div></details>")
                count += 1
                out.append(f'<details class="doc-section" id="{ident}-sec-{count}" open><summary>{inline(title,source)}</summary><div class="section-body">')
                section = True
            else:
                out.append(f"<h{level}>{inline(title,source)}</h{level}>")
            i += 1; continue
        if re.match(r"^[-*_]{3,}$", line):
            i += 1; continue
        if line.startswith("|") and i+1<len(lines) and re.match(r"^\|[\s:|\-]+$", lines[i+1].strip()):
            cells = lambda row: [c.strip() for c in row.strip().strip("|").split("|")]
            headers = cells(line)
            out.append('<div class="table-wrap" tabindex="0" role="region" aria-label="Tabela do documento"><table><thead><tr>'+''.join('<th scope="col">'+inline(c,source)+'</th>' for c in headers)+'</tr></thead><tbody>')
            i += 2
            while i<len(lines) and lines[i].strip().startswith("|"):
                out.append("<tr>"+''.join("<td>"+inline(c,source)+"</td>" for c in cells(lines[i]))+"</tr>"); i += 1
            out.append("</tbody></table></div>"); continue
        if line.startswith(">"):
            quote=[]
            while i<len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip()[1:].strip()); i+=1
            out.append("<blockquote>"+inline(" ".join(quote),source)+"</blockquote>"); continue
        item = re.match(r"^([-*]|\d+\.)\s+(.+)", line)
        if item:
            tag = "ol" if item[1][0].isdigit() else "ul"
            out.append("<"+tag+">")
            while i<len(lines):
                match = re.match(r"^([-*]|\d+\.)\s+(.+)", lines[i].strip())
                if not match: break
                value = match[2]; i+=1
                while i<len(lines) and lines[i].startswith(("  ","\t")) and lines[i].strip():
                    value += " "+lines[i].strip(); i+=1
                out.append("<li>"+inline(value,source)+"</li>")
            out.append("</"+tag+">"); continue
        paragraph=[line]; i+=1
        while i<len(lines) and lines[i].strip() and not re.match(r"^(#|\||>|~~~|```|[-*] |\d+\. )",lines[i].strip()):
            paragraph.append(lines[i].strip()); i+=1
        out.append("<p>"+inline(" ".join(paragraph),source)+"</p>")
    if section: out.append("</div></details>")
    return "\n".join(out)

articles=[]
for ident,title,path in FILES:
    body=markdown((DOCS/path).read_text(encoding="utf-8"),path,ident)
    kind="benchmark-report" if path.startswith("benchmark/") else "page document-page"
    hidden="" if kind=="benchmark-report" else " hidden"
    title_tag="h3" if kind=="benchmark-report" else "h1"
    article=f'<article id="{ident}" class="{kind}"{hidden}><div class="document-heading"><p class="eyebrow">DOCUMENTO DE REFERÊNCIA</p><{title_tag}>{esc(title)}</{title_tag}><a class="source-link" href="{path}">Abrir Markdown original ↗</a></div>'
    if ident=="arquitetura":
        article+='{{DIAGRAM}}'
    articles.append((ident,article+'<div class="document-content">'+body+'</div></article>'))

# A matriz AWS é extraída da tabela versionada, evitando uma segunda fonte manual.
aws_text=(DOCS/"benchmark/benchmark-aws-memory-matrix.md").read_text(encoding="utf-8")
aws=[]
for line in aws_text.splitlines():
    match=re.match(r"\| \*\*([\d.]+) MiB\*\*.*",line)
    if not match: continue
    cols=line.split("|")
    number=lambda value: float(value.replace(".","").replace(",","."))
    aws.append({
        "memory":int(match[1].replace(".","")),
        "smoke":number(re.search(r"([\d,]+) s",cols[2])[1]),
        "worker":int(re.search(r"~([\d.]+) registros",cols[5])[1].replace(".","")),
        "seconds":number(re.search(r"em ([\d,]+) s",cols[6])[1]),
        "throughput":int(re.search(r"; ([\d.]+) registros",cols[6])[1].replace(".","")),
        "throttles":1 if "1 throttling" in cols[6] else 0
    })
if len(aws)!=4:
    raise ValueError("A tabela da matriz AWS mudou; revise a extração antes de gerar o site.")
data={
    "aws":aws,
    "local":json.loads((SITE/"dados/local-5m-20260907T211528Z.json").read_text(encoding="utf-8")),
    "localMatrix":json.loads((SITE/"dados/matriz-local-20260908T234320Z.json").read_text(encoding="utf-8"))
}
template=(SITE/"template.html").read_text(encoding="utf-8")
diagram=(SITE/"diagrama.html").read_text(encoding="utf-8")
template=template.replace("{{DOCUMENTS}}","\n".join(a for ident,a in articles if ident in ("requisitos","arquitetura","blueprint")))
template=template.replace("{{REPORTS}}","\n".join('<details class="report"><summary>'+esc(title)+'</summary>'+dict(articles)[ident]+'</details>' for ident,title,path in FILES if path.startswith("benchmark/")))
template=template.replace("{{DIAGRAM}}",diagram)
template=template.replace("{{DATA}}",json.dumps(data,ensure_ascii=False).replace("<","\\u003c"))
(DOCS/"index.html").write_text(template,encoding="utf-8")
print("Site gerado: documentacao/index.html · 8 documentos · 4 perfis AWS")
