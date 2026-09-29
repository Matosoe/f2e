"use strict";
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const data = JSON.parse($("#benchmark-data").textContent);
const format = (value, digits = 0) => new Intl.NumberFormat("pt-BR", {minimumFractionDigits: digits, maximumFractionDigits: digits}).format(value);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pages = $$(".page");
const search = $("#search");
const normalize = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const nodes = {
  s3: ["Amazon S3 · identidade do arquivo", "Guarda o objeto de entrada e envia ObjectCreated ao intake. O Organizer fixa VersionId quando disponível; sem versão, registra ETag e tamanho e usa leituras condicionais. O Worker lê faixas de bytes com Range GET.", "Origem → intake · leituras de Organizer e Worker. Sobrescrita sem versão pode inviabilizar o replay."],
  intake: ["SQS file-intake · admissão assíncrona", "Recebe notificações S3 ou OrganizerRequest explícita. Aciona o Organizer; falhas parciais de lote permitem repetir somente mensagens que falharam.", "Entrada → Organizer · tentativas esgotadas → DLQ de intake."],
  organizer: ["Lambda Organizer · admissão e planejamento", "Valida limites, fixa a identidade do objeto, registra o plano no ledger e agenda ChunkJobs. Para notificações S3, seleciona a configuração SSM pelo prefixo mais específico. Cada job preserva um snapshot da configuração.", "Consulta S3 + SSM + DynamoDB · publica em chunk-jobs."],
  chunks: ["SQS chunk-jobs · trabalho compartilhado", "Desacopla planejamento e processamento. Cada chunk é uma unidade de retry e paralelismo. Todos os prefixos usam a mesma fila e disputam a capacidade do Worker.", "Organizer → Worker · tentativas esgotadas → DLQ de chunks."],
  worker: ["Lambda Worker · leitura e publicação", "Lê S3 Range GET, resolve fronteiras de registros e publica Envelope v1 ou bundles no destino indicado pelo job. Atualiza estados e contagens no ledger e entrega a outbox de conclusão.", "Lê S3 · atualiza DynamoDB · publica registros e conclusão. Entrega at-least-once."],
  output: ["SQS output-events · contrato de saída", "Recebe os registros em uma fila padrão ou dedicada ao prefixo. example-json/ usa saída dedicada; example-text/ e example-multi-line/ usam a padrão. O consumidor aplica regras de negócio e deduplica os efeitos.", "Worker → consumidores · fila dedicada separa o backlog de consumo, mas não isola a capacidade do Worker."],
  ssm: ["SSM Parameter Store · configuração", "Armazena limites globais e configuração por bucket/prefixo. A maior correspondência de prefixo vence. O snapshot do job preserva os valores admitidos; mudanças afetam novas admissões. Requisições explícitas usam o contrato recebido e padrões da Lambda.", "SSM ↔ Organizer · parâmetros inválidos ou acima dos tetos impedem a admissão."],
  ledger: ["DynamoDB job-ledger · estado técnico", "Persiste admissão, plano, chunks, contadores, checkpoints e intenção durável de conclusão. É compartilhado entre prefixos e apoia recuperação e replay. Não substitui a persistência de negócio.", "Organizer + Worker ↔ ledger · não existe transação distribuída entre DynamoDB e SQS."],
  completion: ["SQS completion-events · conclusão", "O Worker envia a intenção persistida no ledger e só depois marca a entrega. Uma reentrega de chunk ou controle reconcilia intenções pendentes. Duplicações são possíveis com eventId estável; não há DynamoDB Stream nesse caminho.", "Ledger → Worker → SQS · conclusão técnica não confirma consumo dos registros downstream."],
  dlq: ["Dead-letter queues · tratamento de falhas", "Intake, chunks e conclusão possuem DLQs. Mensagens que excedem o limite de tentativas seguem para investigação operacional. As filas de saída não têm DLQ de consumo provisionada pelo F2E.", "DLQ isola a falha; correção e redrive exigem ação operacional. O consumidor define a política da saída."],
  observability: ["CloudWatch · observabilidade", "Reúne logs, métricas, dashboard e alarmes para Lambdas, filas principais e DLQs. Acompanhe idade das mensagens, backlog, erros, throttles, duração e os identificadores do ledger.", "O monitoramento Terraform documentado não inclui as filas de saída dedicadas."]
};
function selectNode(key) {
  const node = nodes[key];
  $$(".architecture-map [data-node]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.node === key)));
  $("#node-detail").innerHTML = "<h3>"+node[0]+"</h3><p>"+node[1]+"</p><small>"+node[2]+"</small>";
}
$$("[data-node]").forEach(button => button.addEventListener("click", () => selectNode(button.dataset.node)));
selectNode("s3");

const reportIds = new Set($$(".benchmark-report").map(report => report.id));
function route() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)) || "inicio"; } catch { id = "inicio"; }
  let target = document.getElementById(id);
  let page = target?.closest(".page");
  if (!page) { page = $("#inicio"); target = page; }
  pages.forEach(item => item.hidden = item !== page);
  $("#search-results").hidden = true;
  search.value = "";
  $$("nav a").forEach(link => {
    if (link.hash === "#"+page.id) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (target !== page) {
    for (let parent = target; parent && parent !== page; parent = parent.parentElement) {
      if (parent.tagName === "DETAILS") parent.open = true;
    }
    if (reportIds.has(id)) target.closest(".report").open = true;
    requestAnimationFrame(() => target.scrollIntoView({block: "start"}));
  } else {
    window.scrollTo({top: 0, behavior: "instant"});
  }
  document.title = "F2E · "+($("h1",page)?.textContent.replace(/\s+/g," ") || "Documentação técnica");
}
window.addEventListener("hashchange", route);
document.addEventListener("click", event => {
  const link = event.target.closest("a[href^=\"#\"]");
  if (link && link.hash === location.hash && link.hash !== "#conteudo") route();
});
const searchIndex = $$(".doc-section").map(section => {
  const article = section.closest("article");
  const title = $("summary",section).textContent;
  const articleTitle = $(".document-heading h1, .document-heading h3",article).textContent;
  const body = $(".section-body",section).textContent.replace(/\s+/g," ").trim();
  return {id: section.id, title, articleTitle, body, haystack: normalize(articleTitle+" "+title+" "+body)};
});
search.addEventListener("input", () => {
  const query = normalize(search.value.trim());
  if (!query) { route(); return; }
  pages.forEach(page => page.hidden = true);
  $("#search-results").hidden = false;
  const matches = searchIndex.filter(item => query.split(/\s+/).every(term => item.haystack.includes(term)));
  $("#search-count").textContent = matches.length+" seções encontradas";
  $("#search-list").innerHTML = matches.map(item => {
    const position = Math.max(0, normalize(item.body).indexOf(query.split(/\s+/)[0]) - 60);
    const excerpt = (position ? "… " : "")+item.body.slice(position,position+240)+(item.body.length>position+240?"…":"");
    return '<a class="search-result" href="#'+item.id+'"><small>'+escapeHtml(item.articleTitle)+'</small><strong>'+escapeHtml(item.title)+'</strong><p>'+escapeHtml(excerpt)+'</p></a>';
  }).join("") || '<div class="note">Nenhum resultado. Tente “replay”, “bundle”, “timeout” ou o nome de um componente.</div>';
});
$("#search-list").addEventListener("click", event => {
  const link = event.target.closest("a");
  if (link && link.hash === location.hash) route();
});
document.addEventListener("keydown", event => {
  if (event.key === "/" && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault(); search.focus();
  }
  if (event.key === "Escape" && document.activeElement === search) { search.value = ""; route(); search.blur(); }
});

function selectBench(key) {
  $$("[data-bench]").forEach(button => {
    const selected = button.dataset.bench === key;
    button.setAttribute("aria-selected",String(selected));
    button.tabIndex = selected ? 0 : -1;
    $("#bench-"+button.dataset.bench).hidden = !selected;
  });
}
$$("[data-bench]").forEach((button,index,buttons) => {
  button.addEventListener("click",()=>selectBench(button.dataset.bench));
  button.addEventListener("keydown",event=>{
    const offsets = {ArrowRight:1,ArrowLeft:-1,Home:-index,End:buttons.length-1-index};
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const next=buttons[(index+offsets[event.key]+buttons.length)%buttons.length];
    selectBench(next.dataset.bench); next.focus();
  });
});
let selectedMemory = 1024;
function renderChart() {
  const metric = $("#metric").value;
  const config = {
    seconds:["Tempo ponta a ponta","Menor é melhor · segundos entre o início do upload e o estado terminal do ledger.","s",2],
    throughput:["Vazão do fluxo","Maior é melhor · registros lógicos por segundo no fluxo completo.","reg/s",0],
    worker:["Capacidade média por Worker","Maior é melhor · 62.500 registros divididos pela duração média da invocação.","reg/s",0]
  }[metric];
  $("#chart-title").textContent = config[0];
  $("#chart-hint").textContent = config[1];
  const max = Math.max(...data.aws.map(row => row[metric]));
  $("#chart").innerHTML = data.aws.map(row => '<button class="chart-row" data-memory="'+row.memory+'" aria-pressed="'+(row.memory===selectedMemory)+'" aria-label="'+format(row.memory)+' MiB: '+format(row[metric],config[3])+' '+config[2]+'"><span>'+format(row.memory)+' MiB</span><span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:'+(row[metric]/max*100).toFixed(2)+'%"></span></span><span class="chart-value">'+format(row[metric],config[3])+' '+config[2]+'</span></button>').join("");
  const row=data.aws.find(item=>item.memory===selectedMemory);
  $("#profile-detail").innerHTML='<strong>Perfil selecionado · '+format(row.memory)+' MiB</strong><p>'+format(row.seconds,2)+' s ponta a ponta · '+format(row.throughput)+' registros/s no fluxo · '+format(row.worker)+' registros/s por Worker.</p><p>Smoke de 10 mil: '+format(row.smoke,2)+' s. Carga de 5 milhões concluída; zero erros, rejeições e DLQs. '+(row.throttles?'1 throttling isolado.':'Sem throttling registrado.')+'</p>';
}
$("#chart").addEventListener("click",event=>{
  const button=event.target.closest("[data-memory]");
  if(!button)return;
  selectedMemory=Number(button.dataset.memory); renderChart();
  $('#chart [data-memory="'+selectedMemory+'"]').focus({preventScroll:true});
});
$("#metric").addEventListener("change",renderChart);
$("#aws-rows").innerHTML=data.aws.map(row=>"<tr><td><strong>"+format(row.memory)+" MiB</strong></td><td>"+format(row.smoke,2)+" s</td><td>"+format(row.seconds,2)+" s</td><td>"+format(row.throughput)+" reg/s</td><td>"+format(row.worker)+" reg/s</td><td>"+row.throttles+"</td></tr>").join("");
$("#local-rows").innerHTML=[128,256,512,1024].map(memory=>{
  const row=data.localMatrix.cases.find(item=>item.stage==="full"&&item.parameters.workerMemoryMB===memory);
  const smoke=data.localMatrix.cases.find(item=>item.stage==="smoke"&&item.parameters.workerMemoryMB===memory);
  return "<tr><td>"+format(memory)+" MiB / "+smoke.parameters.workerContainerCPUs.replace(".",",")+"</td>"+(row?"<td><span class=\"badge warning\">Falhou</span></td><td>"+row.result.completedChunks+"/"+row.result.expectedChunks+"</td><td>"+format(row.result.recordsPublished)+"</td><td>"+row.result.intakeDlq+" / "+row.result.chunkDlq+"</td>":"<td>Sem carga completa registrada</td><td>—</td><td>—</td><td>—</td>")+"</tr>";
}).join("");
$("#download-csv").addEventListener("click",()=>{
  const rows=[["execucao","ambiente","modo","registros","memoria_MiB","smoke_s","ponta_a_ponta_s","registros_por_s_fluxo","registros_por_s_worker","throttles"],...data.aws.map(row=>["20260909T123015Z","AWS","bundle",5000000,row.memory,String(row.smoke).replace(".",","),String(row.seconds).replace(".",","),row.throughput,row.worker,row.throttles])];
  const blob=new Blob(["\ufeff"+rows.map(row=>row.join(";")).join("\r\n")+"\r\n"],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url; link.download="f2e-matriz-aws-20260909T123015Z.csv"; document.body.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
renderChart(); route();
