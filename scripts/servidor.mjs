#!/usr/bin/env node
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import zlib from "node:zlib";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Transform } from "node:stream";

const PASTA_DO_EDITOR = path.join(path.dirname(fileURLToPath(import.meta.url)), "editor");
const PREFIXO = "/__redesign/";
const SALTO_A_SALTO = new Set([
  "connection",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "upgrade",
  "te",
  "trailer",
  "proxy-authorization",
  "proxy-authenticate",
]);
const TIPOS = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const HOSTS_LOCAIS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const SITUACOES_ABERTAS = new Set(["pendente", "divergente"]);
const INICIO_DA_ETIQUETA = '<style data-redesign="">@layer redesign;</style><script type="module" src="/__redesign/editor/principal.js?v=';
const FIM_DA_ETIQUETA = '" data-redesign=""></script>';

const opcoes = lerArgumentos(process.argv.slice(2));
const alvo = lerAlvo(opcoes.alvo ?? "3000");
const porta = Number(opcoes.porta ?? 3200);
const pastaDoProjeto = path.resolve(String(opcoes.projeto ?? process.cwd()));
const pastaDoEstado = path.join(pastaDoProjeto, ".redesign");
const arquivoDeMudancas = path.join(pastaDoEstado, "mudancas.json");
const arquivoDeConfig = path.join(pastaDoEstado, "config.json");
const arquivoDoServidor = path.join(pastaDoEstado, "servidor.json");
const enderecosDaRede = opcoes.rede ? enderecosLocaisDaRede() : [];

const agente = alvo.seguro
  ? new https.Agent({ keepAlive: true, rejectUnauthorized: false })
  : new http.Agent({ keepAlive: true });

let estado = lerEstado();
const editores = new Set();
const claudes = new Set();
let marcaDoEditor = "";
let versaoEmCache = "";

function lerArgumentos(lista) {
  const saida = {};
  for (let i = 0; i < lista.length; i++) {
    const item = lista[i];
    if (!item.startsWith("--")) continue;
    const [nome, embutido] = item.slice(2).split("=", 2);
    if (embutido !== undefined) saida[nome] = embutido;
    else if (lista[i + 1] !== undefined && !lista[i + 1].startsWith("--")) saida[nome] = lista[++i];
    else saida[nome] = true;
  }
  return saida;
}

function lerAlvo(texto) {
  const bruto = String(texto);
  const url = /^\d+$/.test(bruto) ? new URL(`http://localhost:${bruto}`) : new URL(bruto);
  const seguro = url.protocol === "https:";
  return { url, seguro, host: url.hostname, porta: Number(url.port || (seguro ? 443 : 80)) };
}

function enderecosLocaisDaRede() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && !item.internal)
    .map((item) => (item.family === "IPv6" ? `[${item.address}]` : item.address));
}

function agora() {
  return new Date().toISOString();
}

function novoId() {
  return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function lerEstado() {
  try {
    const dados = JSON.parse(fs.readFileSync(arquivoDeMudancas, "utf8"));
    if (Array.isArray(dados.mudancas)) return { versao: Number(dados.versao) || 0, mudancas: dados.mudancas };
  } catch {}
  return { versao: 0, mudancas: [] };
}

function lerConfig() {
  try {
    return JSON.parse(fs.readFileSync(arquivoDeConfig, "utf8"));
  } catch {
    return {};
  }
}

function gravarEstado() {
  fs.mkdirSync(pastaDoEstado, { recursive: true });
  const conteudo = JSON.stringify(estado, null, 2) + "\n";
  const temporario = `${arquivoDeMudancas}.${process.pid}.tmp`;
  fs.writeFileSync(temporario, conteudo);
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    try {
      fs.renameSync(temporario, arquivoDeMudancas);
      return;
    } catch {}
  }
  fs.writeFileSync(arquivoDeMudancas, conteudo);
  fs.rmSync(temporario, { force: true });
}

function excluirDoGit() {
  try {
    const relativo = execFileSync("git", ["rev-parse", "--git-path", "info/exclude"], {
      cwd: pastaDoProjeto,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const arquivo = path.resolve(pastaDoProjeto, relativo);
    const atual = fs.existsSync(arquivo) ? fs.readFileSync(arquivo, "utf8") : "";
    const linhas = atual.split(/\r?\n/).map((linha) => linha.trim());
    if (linhas.includes(".redesign/") || linhas.includes("/.redesign/")) return "already there";
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    fs.appendFileSync(arquivo, (atual && !atual.endsWith("\n") ? "\n" : "") + ".redesign/\n");
    return "added";
  } catch {
    return "no git";
  }
}

function limpar(valor, profundidade = 0) {
  if (valor === null || typeof valor === "boolean") return valor;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor === "string") return valor.slice(0, 4000);
  if (profundidade > 5) return null;
  if (Array.isArray(valor)) return valor.slice(0, 60).map((item) => limpar(item, profundidade + 1));
  if (typeof valor === "object") {
    const saida = {};
    for (const [chave, item] of Object.entries(valor).slice(0, 60)) {
      if (chave === "__proto__" || chave === "constructor" || chave === "prototype") continue;
      saida[chave.slice(0, 80)] = limpar(item, profundidade + 1);
    }
    return saida;
  }
  return null;
}

function contarAbertas() {
  return estado.mudancas.filter((m) => SITUACOES_ABERTAS.has(m.situacao)).length;
}

const OPERACOES_QUE_MUDAM = new Set(["definir", "remover", "limpar", "esquecer-historico", "aplicadas", "conferida", "divergente"]);

function operar(pedido) {
  if (pedido.op === "lote") {
    if (!Array.isArray(pedido.ops) || pedido.ops.length > 500) return { ok: false, erro: "invalid batch" };
    const resultados = pedido.ops.map((op) => aplicarOperacao(op ?? {}));
    const falha = resultados.find((resultado) => !resultado.ok);
    if (pedido.ops.some((op) => OPERACOES_QUE_MUDAM.has(op?.op))) persistir();
    return { ok: !falha, erro: falha?.erro, resultados, estado };
  }
  const resultado = aplicarOperacao(pedido);
  if (resultado.ok && OPERACOES_QUE_MUDAM.has(pedido.op) && !resultado.ignorada) persistir();
  return { ...resultado, versao: estado.versao };
}

function persistir() {
  estado.versao++;
  gravarEstado();
  avisarEditores();
}

function aplicarOperacao(pedido) {
  const resposta = { ok: true };
  switch (pedido.op) {
    case "definir": {
      const nova = limpar(pedido.mudanca);
      if (!nova || typeof nova !== "object" || typeof nova.chave !== "string" || typeof nova.tipo !== "string") {
        return { ok: false, erro: "change without a key or type" };
      }
      const indice = estado.mudancas.findIndex((m) => m.chave === nova.chave && SITUACOES_ABERTAS.has(m.situacao));
      if (indice >= 0) {
        const atual = estado.mudancas[indice];
        estado.mudancas[indice] = {
          ...atual,
          ...nova,
          id: atual.id,
          antes: atual.antes,
          antesCalculado: atual.antesCalculado ?? nova.antesCalculado,
          criadaEm: atual.criadaEm,
          alteradaEm: agora(),
          situacao: "pendente",
          conferencia: null,
        };
        resposta.id = atual.id;
      } else {
        const id = typeof nova.id === "string" && nova.id ? nova.id : novoId();
        estado.mudancas.push({ ...nova, id, situacao: "pendente", criadaEm: agora(), alteradaEm: agora() });
        resposta.id = id;
      }
      break;
    }
    case "remover": {
      const ids = new Set([pedido.ids ?? [], pedido.id ?? []].flat().map(String));
      estado.mudancas = estado.mudancas.filter((m) => !(ids.has(m.id) && SITUACOES_ABERTAS.has(m.situacao)));
      break;
    }
    case "limpar": {
      estado.mudancas = estado.mudancas.filter((m) => !SITUACOES_ABERTAS.has(m.situacao));
      break;
    }
    case "esquecer-historico": {
      estado.mudancas = estado.mudancas.filter((m) => SITUACOES_ABERTAS.has(m.situacao));
      break;
    }
    case "aplicadas": {
      const ids = new Set((pedido.ids ?? []).map(String));
      const nota = typeof pedido.nota === "string" ? pedido.nota.slice(0, 2000) : null;
      let marcadas = 0;
      for (const m of estado.mudancas) {
        if (!ids.has(m.id) || !SITUACOES_ABERTAS.has(m.situacao)) continue;
        m.situacao = "aplicada";
        m.aplicadaEm = agora();
        m.conferencia = null;
        if (nota) m.notaDoClaude = nota;
        marcadas++;
      }
      resposta.marcadas = marcadas;
      break;
    }
    case "conferida":
    case "divergente": {
      const m = estado.mudancas.find((item) => item.id === String(pedido.id));
      if (!m || m.situacao !== "aplicada") return { ok: true, ignorada: true };
      const conferencia = limpar(pedido.conferencia ?? {});
      if (pedido.op === "conferida") {
        m.situacao = "conferida";
        m.conferencia = { ...conferencia, resultado: "ok", em: agora() };
      } else {
        m.situacao = "divergente";
        m.conferencia = { ...conferencia, resultado: "divergente", em: agora() };
      }
      avisarClaude({ evento: "conferencia", id: m.id, resultado: m.conferencia.resultado, resumo: resumir(m), ...conferencia });
      break;
    }
    case "pedido": {
      const nota = typeof pedido.nota === "string" ? pedido.nota.slice(0, 4000) : "";
      const abertas = contarAbertas();
      avisarClaude({ evento: "pedido", pendentes: abertas, nota });
      resposta.claudesOuvindo = claudes.size;
      resposta.pendentes = abertas;
      return resposta;
    }
    default:
      return { ok: false, erro: `unknown operation: ${pedido.op}` };
  }
  return resposta;
}

function resumir(m) {
  const onde = m.alvo?.seletor ?? "?";
  if (m.tipo === "estilo") return `${onde} ${m.propriedade}: ${m.antes} -> ${m.depois}`;
  if (m.tipo === "texto") return `${onde} texto: "${m.antes}" -> "${m.depois}"`;
  return `${onde} ${m.tipo}: ${m.texto ?? ""}`;
}

function avisarEditores() {
  const linha = `event: estado\ndata: ${JSON.stringify(estado)}\n\n`;
  for (const res of editores) res.write(linha);
}

function versaoDoEditor() {
  let nomes;
  try {
    nomes = fs.readdirSync(PASTA_DO_EDITOR).filter((nome) => /\.(js|css)$/.test(nome)).sort();
  } catch {
    return "";
  }
  const marca = nomes
    .map((nome) => {
      try {
        const info = fs.statSync(path.join(PASTA_DO_EDITOR, nome));
        return `${nome}:${info.size}:${info.mtimeMs}`;
      } catch {
        return `${nome}:sumiu`;
      }
    })
    .join("|");
  if (marca === marcaDoEditor) return versaoEmCache;
  const resumo = crypto.createHash("sha1");
  for (const nome of nomes) {
    resumo.update(`${nome}\n`);
    try {
      resumo.update(fs.readFileSync(path.join(PASTA_DO_EDITOR, nome)));
    } catch {}
  }
  marcaDoEditor = marca;
  versaoEmCache = resumo.digest("hex").slice(0, 12);
  return versaoEmCache;
}

function linhaDaVersao() {
  return `event: editor\ndata: ${JSON.stringify({ versao: versaoDoEditor() })}\n\n`;
}

function vigiarEditor() {
  let ultima = versaoDoEditor();
  let temporizador = null;
  try {
    fs.watch(PASTA_DO_EDITOR, () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        const atual = versaoDoEditor();
        if (!atual || atual === ultima) return;
        ultima = atual;
        const linha = linhaDaVersao();
        for (const res of editores) res.write(linha);
      }, 250);
    });
  } catch (erro) {
    console.error(`redesign mode: couldn't watch ${PASTA_DO_EDITOR} (${erro.message}); open tabs only see a new editor after they reconnect.`);
  }
}

function linhaDaPresenca() {
  return `event: claude\ndata: ${JSON.stringify({ ouvindo: claudes.size })}\n\n`;
}

function avisarPresenca() {
  const linha = linhaDaPresenca();
  for (const res of editores) res.write(linha);
}

function avisarClaude(objeto) {
  const linha = JSON.stringify({ ...objeto, quando: agora() }) + "\n";
  for (const res of claudes) res.write(linha);
}

function hostPermitido(host) {
  if (!host) return false;
  let nome;
  try {
    nome = new URL(`http://${host}`).hostname;
  } catch {
    return false;
  }
  return HOSTS_LOCAIS.has(nome) || enderecosDaRede.includes(nome);
}

function escritaPermitida(req) {
  if (req.headers["x-redesign"] !== "1") return false;
  const origem = req.headers.origin;
  if (!origem) return true;
  try {
    return new URL(origem).host === req.headers.host;
  } catch {
    return false;
  }
}

function json(res, codigo, corpo) {
  res.writeHead(codigo, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(corpo));
}

function lerCorpo(req, limite) {
  return new Promise((resolver, rejeitar) => {
    const partes = [];
    let total = 0;
    req.on("data", (parte) => {
      total += parte.length;
      if (total > limite) {
        rejeitar(new Error("body too large"));
        req.destroy();
      } else partes.push(parte);
    });
    req.on("end", () => resolver(Buffer.concat(partes).toString("utf8")));
    req.on("error", rejeitar);
  });
}

function servirEditor(res, nome) {
  if (!/^[a-z0-9-]+\.(js|css|svg|woff2)$/.test(nome)) return json(res, 404, { erro: "not found" });
  fs.readFile(path.join(PASTA_DO_EDITOR, nome), (erro, dados) => {
    if (erro) return json(res, 404, { erro: "not found" });
    const cache = nome.endsWith(".woff2") ? "public, max-age=604800" : "no-store";
    res.writeHead(200, { "content-type": TIPOS[path.extname(nome)], "cache-control": cache });
    res.end(dados);
  });
}

function abrirEventosDoEditor(req, res) {
  res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store" });
  res.write(`retry: 1000\n\nevent: estado\ndata: ${JSON.stringify(estado)}\n\n${linhaDaVersao()}${linhaDaPresenca()}`);
  editores.add(res);
  const batida = setInterval(() => res.write(": ping\n\n"), 20000);
  req.on("close", () => {
    clearInterval(batida);
    editores.delete(res);
  });
}

function abrirFluxoDoClaude(req, res) {
  res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" });
  res.write(JSON.stringify({ evento: "conectado", pendentes: contarAbertas(), editores: editores.size, quando: agora() }) + "\n");
  claudes.add(res);
  avisarPresenca();
  const pulso = setInterval(() => res.write(JSON.stringify({ evento: "pulso" }) + "\n"), 60000);
  req.on("close", () => {
    clearInterval(pulso);
    claudes.delete(res);
    avisarPresenca();
  });
}

async function atenderRedesign(req, res, caminho) {
  if (!hostPermitido(req.headers.host)) return json(res, 403, { erro: "host refused" });
  if (caminho.startsWith("editor/") && req.method === "GET") return servirEditor(res, caminho.slice("editor/".length));
  if (caminho === "api/estado" && req.method === "GET") {
    return json(res, 200, {
      ...estado,
      config: lerConfig(),
      projeto: { nome: path.basename(pastaDoProjeto), alvo: alvo.url.origin, porta },
    });
  }
  if (caminho === "api/eventos" && req.method === "GET") return abrirEventosDoEditor(req, res);
  if (caminho === "api/claude" && req.method === "GET") return abrirFluxoDoClaude(req, res);
  if (caminho === "api/operacao" && req.method === "POST") {
    if (!escritaPermitida(req)) return json(res, 403, { erro: "origin refused" });
    let pedido;
    try {
      pedido = JSON.parse(await lerCorpo(req, 4_000_000));
    } catch (erro) {
      return json(res, 400, { erro: `unreadable request: ${erro.message}` });
    }
    const resposta = operar(pedido ?? {});
    return json(res, resposta.ok ? 200 : 400, resposta);
  }
  json(res, 404, { erro: "not found" });
}

function semSaltoASalto(cabecalhos) {
  const saida = {};
  for (const [nome, valor] of Object.entries(cabecalhos)) {
    if (!SALTO_A_SALTO.has(nome)) saida[nome] = valor;
  }
  return saida;
}

function reescreverEndereco(endereco, req) {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(endereco)) return endereco;
  try {
    const url = new URL(endereco);
    const apontaParaOAlvo = url.host === alvo.url.host || (HOSTS_LOCAIS.has(url.hostname) && Number(url.port) === alvo.porta);
    if (apontaParaOAlvo) return `http://${req.headers.host}${url.pathname}${url.search}${url.hash}`;
  } catch {}
  return endereco;
}

function injetor() {
  let acumulado = Buffer.alloc(0);
  let concluido = false;
  return new Transform({
    transform(parte, _codificacao, seguir) {
      if (concluido) return seguir(null, parte);
      acumulado = Buffer.concat([acumulado, parte]);
      const achado = /<head\b[^>]*>/i.exec(acumulado.toString("latin1"));
      if (achado) {
        concluido = true;
        const fim = achado.index + achado[0].length;
        const etiqueta = Buffer.from(`${INICIO_DA_ETIQUETA}${versaoDoEditor()}${FIM_DA_ETIQUETA}`);
        const saida = Buffer.concat([acumulado.subarray(0, fim), etiqueta, acumulado.subarray(fim)]);
        acumulado = Buffer.alloc(0);
        return seguir(null, saida);
      }
      if (acumulado.length > 512 * 1024) {
        concluido = true;
        const saida = acumulado;
        acumulado = Buffer.alloc(0);
        return seguir(null, saida);
      }
      seguir();
    },
    flush(seguir) {
      if (acumulado.length) this.push(acumulado);
      seguir();
    },
  });
}

function descompressorPara(codificacao) {
  if (codificacao === "gzip" || codificacao === "x-gzip") return zlib.createGunzip();
  if (codificacao === "br") return zlib.createBrotliDecompress();
  if (codificacao === "deflate") return zlib.createInflate();
  return null;
}

function responder(req, res, resposta) {
  const cabecalhos = semSaltoASalto(resposta.headers);
  if (cabecalhos.location) cabecalhos.location = reescreverEndereco(cabecalhos.location, req);
  const ehHtml =
    /text\/html/i.test(String(resposta.headers["content-type"] ?? "")) &&
    req.method !== "HEAD" &&
    resposta.statusCode !== 204 &&
    resposta.statusCode !== 304;
  const codificacao = String(resposta.headers["content-encoding"] ?? "").toLowerCase();
  const descompressor = ehHtml && codificacao ? descompressorPara(codificacao) : null;
  if (!ehHtml || (codificacao && !descompressor)) {
    res.writeHead(resposta.statusCode, resposta.statusMessage, cabecalhos);
    resposta.pipe(res);
    return;
  }
  delete cabecalhos["content-length"];
  delete cabecalhos["content-encoding"];
  delete cabecalhos["content-security-policy"];
  delete cabecalhos["content-security-policy-report-only"];
  res.writeHead(resposta.statusCode, resposta.statusMessage, cabecalhos);
  const corpo = descompressor ? resposta.pipe(descompressor) : resposta;
  corpo.on("error", () => res.destroy());
  corpo.pipe(injetor()).pipe(res);
}

function paginaDeEspera(motivo) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="2">
<title>Waiting for the project</title><style>
html{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111113;color:#e8e6e3;font:15px/1.5 system-ui,sans-serif}
main{max-width:30rem;padding:24px}h1{font-size:18px;margin:0 0 8px}p{margin:0;color:#a29f9a}code{color:#e8e6e3}
</style></head><body><main><h1>The project didn't respond at ${alvo.url.origin}</h1>
<p>Redesign mode tries again every 2 seconds. Reason: <code>${motivo}</code></p></main></body></html>`;
}

function falhaDoAlvo(req, res, erro) {
  if (res.headersSent) return res.destroy();
  const motivo = String(erro.code ?? erro.message).replace(/[<>&]/g, "");
  if (/text\/html/.test(String(req.headers.accept ?? ""))) {
    res.writeHead(502, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    return res.end(paginaDeEspera(motivo));
  }
  res.writeHead(502, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  res.end(`The project at ${alvo.url.origin} didn't respond (${motivo}).`);
}

function repassar(req, res) {
  const cabecalhos = semSaltoASalto(req.headers);
  delete cabecalhos["accept-encoding"];
  const modulo = alvo.seguro ? https : http;
  const saida = modulo.request(
    {
      host: alvo.host,
      port: alvo.porta,
      method: req.method,
      path: req.url,
      headers: cabecalhos,
      agent: agente,
      servername: alvo.seguro ? alvo.host : undefined,
    },
    (resposta) => {
      res.on("close", () => resposta.destroy());
      responder(req, res, resposta);
    },
  );
  saida.on("error", (erro) => falhaDoAlvo(req, res, erro));
  req.pipe(saida);
}

function tunelar(req, cliente, cabeca) {
  const destino = alvo.seguro
    ? tls.connect({ host: alvo.host, port: alvo.porta, servername: alvo.host, rejectUnauthorized: false })
    : net.connect({ host: alvo.host, port: alvo.porta });
  destino.once(alvo.seguro ? "secureConnect" : "connect", () => {
    const linhas = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) linhas.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    destino.write(linhas.join("\r\n") + "\r\n\r\n");
    if (cabeca?.length) destino.write(cabeca);
    destino.setNoDelay(true);
    cliente.setNoDelay(true);
    destino.pipe(cliente);
    cliente.pipe(destino);
  });
  const encerrar = () => {
    destino.destroy();
    cliente.destroy();
  };
  destino.on("error", encerrar);
  cliente.on("error", encerrar);
  destino.on("close", encerrar);
  cliente.on("close", encerrar);
}

function atender(req, res) {
  const caminho = (req.url ?? "/").split("?")[0];
  if (caminho.startsWith(PREFIXO)) {
    atenderRedesign(req, res, caminho.slice(PREFIXO.length)).catch((erro) => {
      if (!res.headersSent) json(res, 500, { erro: erro.message });
      else res.destroy();
    });
    return;
  }
  repassar(req, res);
}

function aoPedirUpgrade(req, socket, cabeca) {
  if ((req.url ?? "").startsWith(PREFIXO)) return socket.destroy();
  tunelar(req, socket, cabeca);
}

function escutarEm(endereco) {
  return new Promise((resolver) => {
    const servidor = http.createServer(atender);
    servidor.on("upgrade", aoPedirUpgrade);
    servidor.once("error", (erro) => resolver({ endereco, erro }));
    servidor.listen(porta, endereco, () => resolver({ endereco, servidor }));
  });
}

async function alvoResponde() {
  return new Promise((resolver) => {
    const modulo = alvo.seguro ? https : http;
    const pedido = modulo.request(
      { host: alvo.host, port: alvo.porta, method: "HEAD", path: "/", timeout: 3000, rejectUnauthorized: false },
      (resposta) => {
        resposta.resume();
        resolver(`responded ${resposta.statusCode}`);
      },
    );
    pedido.on("timeout", () => {
      pedido.destroy();
      resolver("no response in 3 s");
    });
    pedido.on("error", (erro) => resolver(`down (${erro.code ?? erro.message})`));
    pedido.end();
  });
}

async function iniciar() {
  fs.mkdirSync(pastaDoEstado, { recursive: true });
  const git = excluirDoGit();
  const enderecos = opcoes.rede ? ["::"] : ["127.0.0.1", "::1"];
  const resultados = [];
  for (const endereco of enderecos) resultados.push(await escutarEm(endereco));
  const principal = resultados[0];
  if (principal.erro) {
    const motivo = principal.erro.code === "EADDRINUSE" ? `port ${porta} is already in use` : principal.erro.message;
    console.error(`redesign mode: didn't start, ${motivo}.`);
    process.exit(1);
  }
  for (const extra of resultados.slice(1)) {
    if (extra.erro && extra.erro.code !== "EADDRNOTAVAIL" && extra.erro.code !== "EAFNOSUPPORT") {
      console.error(`redesign mode: warning, ${extra.endereco} refused (${extra.erro.code}).`);
    }
  }
  fs.writeFileSync(
    arquivoDoServidor,
    JSON.stringify({ pid: process.pid, porta, alvo: alvo.url.origin, projeto: pastaDoProjeto, inicio: agora() }, null, 2) + "\n",
  );
  const encerrar = () => {
    try {
      const atual = JSON.parse(fs.readFileSync(arquivoDoServidor, "utf8"));
      if (atual.pid === process.pid) fs.rmSync(arquivoDoServidor, { force: true });
    } catch {}
    process.exit(0);
  };
  process.on("SIGINT", encerrar);
  process.on("SIGTERM", encerrar);
  process.on("SIGHUP", encerrar);
  vigiarEditor();
  console.log(`redesign mode: ready at http://localhost:${porta}, forwarding to ${alvo.url.origin} (${await alvoResponde()}).`);
  console.log(`redesign mode: changes in ${arquivoDeMudancas} (${contarAbertas()} open); .redesign/ in the git exclude: ${git}.`);
}

iniciar();
