#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ABERTAS = new Set(["pendente", "divergente"]);
const [comando, ...resto] = process.argv.slice(2);
const opcoes = lerArgumentos(resto);
const pastaDoProjeto = path.resolve(String(opcoes.projeto ?? process.cwd()));
const base = `http://127.0.0.1:${descobrirPorta()}`;

function lerArgumentos(lista) {
  const saida = { soltos: [] };
  for (let i = 0; i < lista.length; i++) {
    const item = lista[i];
    if (!item.startsWith("--")) {
      saida.soltos.push(item);
      continue;
    }
    const [nome, embutido] = item.slice(2).split("=", 2);
    if (embutido !== undefined) saida[nome] = embutido;
    else if (lista[i + 1] !== undefined && !lista[i + 1].startsWith("--")) saida[nome] = lista[++i];
    else saida[nome] = true;
  }
  return saida;
}

function descobrirPorta() {
  if (opcoes.porta) return Number(opcoes.porta);
  try {
    const servidor = JSON.parse(fs.readFileSync(path.join(pastaDoProjeto, ".redesign", "servidor.json"), "utf8"));
    if (servidor.porta) return Number(servidor.porta);
  } catch {}
  return 3200;
}

async function lerEstado() {
  try {
    const resposta = await fetch(`${base}/__redesign/api/estado`);
    if (resposta.ok) return { ...(await resposta.json()), fonte: "servidor" };
  } catch {}
  const arquivo = path.join(pastaDoProjeto, ".redesign", "mudancas.json");
  try {
    return { ...JSON.parse(fs.readFileSync(arquivo, "utf8")), fonte: "arquivo (o servidor não respondeu)" };
  } catch {
    return { versao: 0, mudancas: [], fonte: "nenhuma" };
  }
}

async function operar(corpo) {
  const resposta = await fetch(`${base}/__redesign/api/operacao`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-redesign": "1" },
    body: JSON.stringify(corpo),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro ?? `resposta ${resposta.status}`);
  return dados;
}

function curto(texto, tamanho = 90) {
  const limpo = String(texto ?? "").replace(/\s+/g, " ").trim();
  return limpo.length > tamanho ? `${limpo.slice(0, tamanho - 1)}…` : limpo;
}

function contexto(m) {
  const partes = [m.pagina, m.largura ? `${m.largura}px de largura` : null, m.tema ? `tema ${m.tema}` : null].filter(Boolean);
  return partes.join(" · ");
}

function descreverAlvo(m) {
  const alvo = m.alvo ?? {};
  const alcance = alvo.alcance === "este" ? "só este elemento" : `${alvo.quantos ?? "?"} elemento(s)`;
  const linhas = [`  alvo: ${alvo.seletor} (${alcance})`];
  if (alvo.componentes?.length) linhas.push(`  componentes: ${alvo.componentes.join(" < ")}`);
  if (alvo.texto) linhas.push(`  texto do elemento: "${curto(alvo.texto, 80)}"`);
  if (alvo.caminho) linhas.push(`  caminho: ${alvo.caminho}`);
  return linhas;
}

function imprimirMudanca(m) {
  const cabeca = `[${m.id}] ${m.tipo}${m.situacao === "divergente" ? " · DIVERGENTE" : ""} · ${contexto(m)}`;
  const linhas = [cabeca, ...descreverAlvo(m)];
  if (m.tipo === "estilo") {
    const medido = m.antesCalculado?.[0] && m.depoisCalculado?.[0] ? `   (medido: ${m.antesCalculado[0]} -> ${m.depoisCalculado[0]})` : "";
    linhas.push(`  ${m.propriedade}: ${m.antes} -> ${m.depois}${medido}`);
    if (m.escopoDeTema) linhas.push(`  vale só no tema: ${m.escopoDeTema}`);
    if (m.fonteExterna) linhas.push(`  fonte nova, ainda não instalada no projeto: ${m.fonteExterna}`);
    if (m.origemDoPedido) linhas.push(`  veio de: ${m.origemDoPedido}`);
    const regras = m.regras ?? [];
    if (regras.length) {
      for (const regra of regras.slice(0, 4)) {
        const marcas = [regra.vence ? "VENCE" : null, regra.importante ? "!important" : null, regra.media ? `@media ${regra.media}` : null, regra.camada ? `@layer ${regra.camada}` : null]
          .filter(Boolean)
          .join(" ");
        linhas.push(`  regra: ${regra.seletor} { ${m.propriedade}: ${regra.valor} } em ${regra.origem}${marcas ? `  [${marcas}]` : ""}`);
      }
    } else linhas.push("  regra: nenhuma regra declara essa propriedade aqui; o valor vem de herança ou do navegador");
  } else if (m.tipo === "texto") {
    linhas.push(`  texto: "${m.antes}" -> "${m.depois}"`);
  } else {
    linhas.push(`  ${m.tipo === "pedido" ? "pedido" : "comentário"}: "${m.texto}"`);
  }
  if (m.situacao === "divergente" && m.conferencia) {
    const c = m.conferencia;
    linhas.push(`  conferência: ${c.motivo ?? `esperava ${c.esperado}, o código deu ${c.medido}${c.diferentes ? ` em ${c.diferentes} de ${c.elementos} elementos` : ""}`}`);
  }
  if (m.notaDoClaude) linhas.push(`  nota da aplicação anterior: ${m.notaDoClaude}`);
  return linhas.join("\n");
}

async function pendentes() {
  const estado = await lerEstado();
  const abertas = estado.mudancas.filter((m) => ABERTAS.has(m.situacao));
  if (opcoes.json) {
    console.log(JSON.stringify(abertas, null, 2));
    return;
  }
  if (!abertas.length) {
    console.log(`Nenhuma mudança pendente (fonte: ${estado.fonte}).`);
    return;
  }
  const porArquivo = new Map();
  for (const m of abertas) {
    const arquivo = m.tipo === "estilo" ? m.regras?.find((r) => r.vence)?.origem ?? "sem regra de origem" : m.tipo === "texto" ? "texto no componente" : "comentários e pedidos";
    if (!porArquivo.has(arquivo)) porArquivo.set(arquivo, []);
    porArquivo.get(arquivo).push(m);
  }
  console.log(`${abertas.length} mudanças abertas (fonte: ${estado.fonte}, versão ${estado.versao}).`);
  for (const [arquivo, lista] of porArquivo) {
    console.log(`\n== ${arquivo} (${lista.length})`);
    for (const m of lista) console.log(`\n${imprimirMudanca(m)}`);
  }
  console.log(`\nDepois de aplicar no código: node ${path.relative(process.cwd(), process.argv[1])} aplicadas <id> [<id> ...] --nota "o que foi feito"`);
}

async function aplicadas() {
  const ids = opcoes.soltos;
  if (!ids.length) throw new Error("diga os ids: aplicadas m123 m456");
  const resposta = await operar({ op: "aplicadas", ids, nota: typeof opcoes.nota === "string" ? opcoes.nota : undefined });
  console.log(`${resposta.marcadas ?? 0} de ${ids.length} marcadas como aplicadas. O editor aberto confere sozinho e avisa pelo escutar.`);
  if ((resposta.marcadas ?? 0) < ids.length) console.log("Algum id não estava pendente nem divergente; confira com: pendentes");
}

async function resumo() {
  const estado = await lerEstado();
  const contagem = {};
  for (const m of estado.mudancas) contagem[m.situacao] = (contagem[m.situacao] ?? 0) + 1;
  console.log(`modo redesign em ${base} (fonte: ${estado.fonte})`);
  console.log(Object.entries(contagem).map(([situacao, total]) => `${situacao}: ${total}`).join(" · ") || "nenhuma mudança");
}

function linhaDoEvento(evento) {
  if (evento.evento === "conectado") return `modo redesign: escutando ${base}, ${evento.pendentes} pendentes, ${evento.editores} abas do editor abertas`;
  if (evento.evento === "pedido") return `PEDIDO DO EDITOR: ${evento.pendentes} mudanças pendentes${evento.nota ? `. Recado: ${curto(evento.nota, 300)}` : ""}. Rode: node ${process.argv[1]} pendentes`;
  if (evento.evento === "conferencia" && evento.resultado === "ok") return `CONFERIDA ${evento.id}: ${curto(evento.resumo, 160)}`;
  if (evento.evento === "conferencia") {
    const motivo = evento.motivo ?? `esperava ${evento.esperado}, o código deu ${evento.medido}`;
    return `DIVERGENTE ${evento.id}: ${curto(evento.resumo, 140)}. ${motivo}`;
  }
  return `evento ${JSON.stringify(evento).slice(0, 300)}`;
}

async function escutar() {
  let caido = false;
  for (;;) {
    try {
      const resposta = await fetch(`${base}/__redesign/api/claude`);
      if (!resposta.ok || !resposta.body) throw new Error(`resposta ${resposta.status}`);
      if (caido) console.log(`modo redesign: ${base} voltou`);
      caido = false;
      const leitor = resposta.body.getReader();
      const decodificador = new TextDecoder();
      let pedaco = "";
      for (;;) {
        const { value, done } = await leitor.read();
        if (done) break;
        pedaco += decodificador.decode(value, { stream: true });
        const linhas = pedaco.split("\n");
        pedaco = linhas.pop();
        for (const linha of linhas) {
          if (!linha.trim()) continue;
          try {
            const evento = JSON.parse(linha);
            if (evento.evento === "pulso") continue;
            console.log(linhaDoEvento(evento));
          } catch {
            console.log(`linha ilegível do servidor: ${linha.slice(0, 200)}`);
          }
        }
      }
      throw new Error("conexão fechada");
    } catch (erro) {
      if (!caido) console.log(`modo redesign: ${base} não responde (${erro.message}); tentando de novo a cada 3 s`);
      caido = true;
      await new Promise((resolver) => setTimeout(resolver, 3000));
    }
  }
}

const comandos = { pendentes, aplicadas, estado: resumo, escutar };
const executar = comandos[comando];
if (!executar) {
  console.log("uso: node redesign.mjs <pendentes [--json] | aplicadas <id...> [--nota texto] | estado | escutar> [--projeto pasta] [--porta 3200]");
  process.exit(comando ? 1 : 0);
}
executar().catch((erro) => {
  console.error(`modo redesign: ${erro.message}`);
  process.exit(1);
});
