#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { palavrasEmPortugues, defeitoDeTexto, textosEmPortuguesNaFonte } from "./idioma.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.join(AQUI, "..", "scripts");
const argumentos = process.argv.slice(2);
const valorDe = (nome, padrao) => {
  const i = argumentos.indexOf(`--${nome}`);
  return i >= 0 ? argumentos[i + 1] : padrao;
};
const pastaDoPlaywright = path.resolve(valorDe("playwright", process.cwd()));
const PORTA_DO_SITE = Number(valorDe("porta-site", 4400));
const PORTA = Number(valorDe("porta", 4600));
const BASE = `http://localhost:${PORTA}`;

let chromium;
try {
  ({ chromium } = createRequire(path.join(pastaDoPlaywright, "package.json"))("playwright"));
} catch {
  console.error(`Não achei o Playwright em ${pastaDoPlaywright}. Rode de dentro de um projeto que o tenha, ou passe --playwright <pasta>.`);
  process.exit(2);
}

const temporaria = fs.mkdtempSync(path.join(os.tmpdir(), "modo-redesign-prova-"));
const pastaDoSite = path.join(temporaria, "site");
const pastaDoEstado = path.join(temporaria, "projeto");
const copiaDosScripts = path.join(temporaria, "scripts");
fs.cpSync(path.join(AQUI, "site"), pastaDoSite, { recursive: true });
fs.cpSync(SCRIPTS, copiaDosScripts, { recursive: true });
fs.mkdirSync(pastaDoEstado, { recursive: true });

const processos = [];
let falhas = 0;
function conferir(rotulo, ok, detalhe = "") {
  console.log(`${ok ? "OK " : "XX "} ${rotulo}${detalhe !== "" ? `  (${detalhe})` : ""}`);
  if (!ok) falhas++;
}
const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const lerMudancas = () => {
  try {
    return JSON.parse(fs.readFileSync(path.join(pastaDoEstado, ".redesign", "mudancas.json"), "utf8")).mudancas;
  } catch {
    return [];
  }
};

function subir(arquivo, args) {
  const processo = spawn(process.execPath, [arquivo, ...args], { stdio: ["ignore", "pipe", "pipe"] });
  processo.linhas = [];
  for (const fluxo of [processo.stdout, processo.stderr]) {
    let resto = "";
    fluxo.on("data", (dados) => {
      resto += dados.toString();
      const linhas = resto.split("\n");
      resto = linhas.pop();
      processo.linhas.push(...linhas.filter(Boolean));
    });
  }
  processos.push(processo);
  return processo;
}

async function esperarLinha(processo, padrao, ms) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    const achada = processo.linhas.find((linha) => padrao.test(linha));
    if (achada) return achada;
    await esperar(150);
  }
  return null;
}

function pedirCru(caminho, { metodo = "GET", cabecalhos = {}, corpo } = {}) {
  return new Promise((resolver) => {
    const pedido = http.request({ host: "127.0.0.1", port: PORTA, path: caminho, method: metodo, headers: cabecalhos }, (resposta) => {
      resposta.resume();
      resolver(resposta.statusCode);
    });
    pedido.on("error", (erro) => resolver(erro.code));
    if (corpo) pedido.write(corpo);
    pedido.end();
  });
}

function cli(...args) {
  return spawnSync(process.execPath, [path.join(copiaDosScripts, "redesign.mjs"), ...args, "--porta", String(PORTA), "--projeto", pastaDoEstado], { encoding: "utf8" });
}

const avisoDeVersaoVisivel = (pagina) => pagina.evaluate(() => !window.__modoRedesign.ctx.raiz.querySelector(".aviso-versao").classList.contains("oculto"));

function textosDaInterface() {
  const saida = [];
  const ATRIBUTOS = ["aria-label", "data-dica", "placeholder", "title", "alt", "data-atalho"];
  const andar = (no) => {
    if (no.nodeType === 3) {
      const texto = no.data.trim();
      if (texto) saida.push(texto);
      return;
    }
    if (no.nodeType !== 1 || no.getAttribute("translate") === "no" || no.localName === "svg") return;
    for (const nome of ATRIBUTOS) {
      const valor = no.getAttribute(nome);
      if (valor) saida.push(valor);
    }
    if (no.localName === "input" && no.type === "text" && no.value) saida.push(no.value);
    for (const filho of no.childNodes) andar(filho);
  };
  for (const filho of window.__modoRedesign.ctx.raiz.childNodes) andar(filho);
  return [...new Set(saida)];
}

const ofensasDeIdioma = [];
async function varrer(pagina, onde) {
  for (const texto of await pagina.evaluate(textosDaInterface)) {
    const achado = [...palavrasEmPortugues(texto), defeitoDeTexto(texto)].filter(Boolean);
    if (achado.length) ofensasDeIdioma.push(`${onde}: "${texto.slice(0, 70)}" [${achado.join(",")}]`);
  }
}

async function abrirEVarrer(pagina, seletor, onde) {
  await pagina.evaluate((s) => window.__modoRedesign.ctx.raiz.querySelector(s).click(), seletor);
  await esperar(200);
  await varrer(pagina, onde);
  await pagina.keyboard.press("Escape");
  await esperar(120);
}

async function dicaDe(pagina, seletor) {
  const centro = await pagina.evaluate((s) => {
    const caixa = window.__modoRedesign.ctx.raiz.querySelector(s).getBoundingClientRect();
    return { x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 };
  }, seletor);
  await pagina.mouse.move(centro.x, centro.y);
  await esperar(650);
  const dica = await pagina.evaluate(() => {
    const elemento = window.__modoRedesign.ctx.raiz.querySelector(".dica-flutuante");
    return { aberta: elemento.matches(":popover-open"), texto: elemento.textContent, partes: [...elemento.childNodes].map((no) => `${no.localName ?? "texto"}:${no.textContent}`) };
  });
  await pagina.mouse.move(2, 2);
  await esperar(150);
  return dica;
}

async function encerrar(codigo) {
  for (const processo of processos) processo.kill();
  await esperar(300);
  fs.rmSync(temporaria, { recursive: true, force: true });
  process.exit(codigo);
}

try {
  const fontes = [...fs.readdirSync(path.join(copiaDosScripts, "editor")).filter((nome) => nome.endsWith(".js")).map((nome) => path.join("editor", nome)), "servidor.mjs"];
  const emPortugues = fontes.flatMap((nome) => textosEmPortuguesNaFonte(fs.readFileSync(path.join(copiaDosScripts, nome), "utf8")).map((achado) => `${nome}:${achado.linha} "${achado.texto}"`));
  conferir("nenhum texto em português no código do editor e do servidor", emPortugues.length === 0, emPortugues.slice(0, 3).join(" | "));

  const site = subir(path.join(AQUI, "servidor-do-site.mjs"), ["--pasta", pastaDoSite, "--porta", String(PORTA_DO_SITE)]);
  const proxy = subir(path.join(copiaDosScripts, "servidor.mjs"), ["--alvo", `http://127.0.0.1:${PORTA_DO_SITE}`, "--porta", String(PORTA), "--projeto", pastaDoEstado]);
  conferir("site de prova sobe", Boolean(await esperarLinha(site, /site de prova em/, 8000)));
  conferir("modo redesign sobe", Boolean(await esperarLinha(proxy, /ready at/, 8000)), proxy.linhas[0] ?? "");
  const escuta = subir(path.join(copiaDosScripts, "redesign.mjs"), ["escutar", "--porta", String(PORTA), "--projeto", pastaDoEstado]);
  conferir("o escutar conecta", Boolean(await esperarLinha(escuta, /escutando/, 8000)));

  conferir("escrita sem o cabeçalho é recusada", (await pedirCru("/__redesign/api/operacao", { metodo: "POST", corpo: '{"op":"limpar"}' })) === 403);
  conferir(
    "escrita de outra origem é recusada",
    (await pedirCru("/__redesign/api/operacao", { metodo: "POST", cabecalhos: { "x-redesign": "1", origin: "https://malicioso.example", "content-type": "application/json" }, corpo: '{"op":"limpar"}' })) === 403,
  );
  conferir("host de fora é recusado", (await pedirCru("/__redesign/api/estado", { cabecalhos: { host: `malicioso.example:${PORTA}` } })) === 403);

  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1400, height: 900 } });
  await pagina.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  const erros = [];
  pagina.on("pageerror", (erro) => erros.push(erro.message));
  pagina.on("console", (mensagem) => mensagem.type() === "error" && erros.push(mensagem.text()));
  await pagina.route("https://fonts.googleapis.com/**", (rota) => rota.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await pagina.goto(`${BASE}/`, { waitUntil: "load" });
  await pagina.waitForFunction(() => window.__modoRedesign?.ctx?.dock && window.__recarregamento?.canal.readyState === 1, null, { timeout: 15000 });
  conferir("editor injetado e websocket do site passando pelo proxy", true);
  await esperar(800);
  conferir("aba recém-aberta sabe a versão do editor e não pede recarga", /^[0-9a-f]{12}$/.test(await pagina.evaluate(() => window.__modoRedesign.editor)) && !(await avisoDeVersaoVisivel(pagina)));
  await varrer(pagina, "aba recém-aberta");
  const estadoDaPresenca = () => pagina.evaluate(() => window.__modoRedesign.ctx.raiz.querySelector(".presenca").dataset.estado);
  conferir("com o escutar ligado, o ponto do botão Claude acende", (await estadoDaPresenca()) === "ouvindo", await estadoDaPresenca());

  const dicaSemAtalho = await dicaDe(pagina, '.dock-botao[aria-label="Typography"]');
  conferir("dica sem atalho mostra só o texto, sem null", dicaSemAtalho.aberta && dicaSemAtalho.partes.join("|") === "span:Typography", JSON.stringify(dicaSemAtalho));
  const dicaComAtalho = await dicaDe(pagina, ".dock-botao.principal");
  conferir("dica com atalho mostra o texto e a tecla", dicaComAtalho.aberta && dicaComAtalho.partes.join("|") === "span:Edit the page|kbd:E", JSON.stringify(dicaComAtalho));

  const dicaAbertaAgora = () =>
    pagina.evaluate(() => {
      const elemento = window.__modoRedesign.ctx.raiz.querySelector(".dica-flutuante");
      return elemento.matches(":popover-open") ? elemento.textContent : "";
    });
  const centroNaFerramenta = (seletor) =>
    pagina.evaluate((s) => {
      const caixa = window.__modoRedesign.ctx.raiz.querySelector(s).getBoundingClientRect();
      return { x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 };
    }, seletor);
  const botaoDaTipografia = await centroNaFerramenta('.dock-botao[aria-label="Typography"]');
  await pagina.mouse.move(botaoDaTipografia.x, botaoDaTipografia.y, { steps: 3 });
  await esperar(650);
  const dicaAntesDeSair = await dicaAbertaAgora();
  const caixaDaFrase = await pagina.locator(".frase").boundingBox();
  await pagina.mouse.move(caixaDaFrase.x + caixaDaFrase.width / 2, caixaDaFrase.y + caixaDaFrase.height / 2);
  await esperar(250);
  const dicaDepoisDeSair = await dicaAbertaAgora();
  conferir("sair do botão direto para uma página que usa data-dica fecha a dica", dicaAntesDeSair === "Typography" && dicaDepoisDeSair === "", `${dicaAntesDeSair} -> "${dicaDepoisDeSair}"`);

  const botaoDoAcento = await centroNaFerramenta('.dock-botao[aria-label="Accent color"]');
  await pagina.mouse.click(botaoDoAcento.x, botaoDoAcento.y);
  await esperar(250);
  const amostraDoAcento = await centroNaFerramenta(".amostra-acento");
  await pagina.mouse.move(amostraDoAcento.x, amostraDoAcento.y, { steps: 4 });
  await esperar(150);
  await pagina.keyboard.press("Escape");
  await esperar(250);
  await pagina.mouse.move(400, 420, { steps: 5 });
  await esperar(250);
  const dicaDepoisDoEsc = await dicaAbertaAgora();
  conferir("fechar o painel de cor com Esc, com o mouse longe, não deixa dica presa", dicaDepoisDoEsc === "", dicaDepoisDoEsc);

  await pagina.keyboard.press("x");
  await pagina.evaluate(() => window.__modoRedesign.ctx.raiz.querySelector('.dock-botao[aria-label="Properties panel"]').focus());
  await esperar(250);
  const dicaDoFocoDevolvido = await dicaAbertaAgora();
  conferir("foco que volta sem Tab, como ao voltar de outra janela, não abre dica", dicaDoFocoDevolvido === "", dicaDoFocoDevolvido);
  await pagina.evaluate(() => window.__modoRedesign.ctx.raiz.querySelector(".dock-botao.principal").focus());
  await pagina.keyboard.press("Tab");
  await esperar(250);
  const dicaDoTab = await dicaAbertaAgora();
  await pagina.mouse.move(430, 450, { steps: 3 });
  await esperar(200);
  const dicaDepoisDoMouse = await dicaAbertaAgora();
  conferir("a dica do Tab aparece, e some quando o mouse se mexe longe do botão", dicaDoTab === "Properties panelP" && dicaDepoisDoMouse === "", `${dicaDoTab} -> "${dicaDepoisDoMouse}"`);
  await pagina.evaluate(() => window.__modoRedesign.ctx.raiz.activeElement?.blur());
  await abrirEVarrer(pagina, '.dock-botao[aria-label="Accent color"]', "cor de destaque");
  await abrirEVarrer(pagina, '.dock-botao[aria-label="Typography"]', "tipografia");

  const estadoDoEditor = () =>
    pagina.evaluate(() => {
      const ctx = window.__modoRedesign.ctx;
      return { edicao: ctx.selecao.ativo, painel: ctx.painelAberto(), nota: Boolean(ctx.raiz.querySelector(".nota")), selecionado: ctx.selecao.atual?.className ?? null };
    });
  await pagina.mouse.click(700, 860);
  await pagina.keyboard.press("p");
  await esperar(250);
  const depoisDoP = await estadoDoEditor();
  conferir("P com a edição desligada liga a edição e abre o painel", depoisDoP.edicao && depoisDoP.painel, JSON.stringify(depoisDoP));
  await pagina.keyboard.press("p");
  await esperar(250);
  const depoisDoSegundoP = await estadoDoEditor();
  conferir("P de novo fecha o painel e mantém a edição", depoisDoSegundoP.edicao && !depoisDoSegundoP.painel, JSON.stringify(depoisDoSegundoP));
  await pagina.keyboard.press("e");
  await esperar(200);
  const botaoDoPainel = await centroNaFerramenta('.dock-botao[aria-label="Properties panel"]');
  await pagina.mouse.click(botaoDoPainel.x, botaoDoPainel.y);
  await esperar(250);
  const depoisDoBotao = await estadoDoEditor();
  conferir("o botão do painel com a edição desligada abre o painel", depoisDoBotao.edicao && depoisDoBotao.painel, JSON.stringify(depoisDoBotao));
  await pagina.locator(".titulo").click({ position: { x: 10, y: 20 } });
  await esperar(250);
  await pagina.keyboard.press("c");
  await esperar(250);
  const depoisDoC = await estadoDoEditor();
  conferir("depois de clicar na barra do canto, selecionar na página devolve as teclas: C comenta", depoisDoC.nota && depoisDoC.selecionado === "titulo", JSON.stringify(depoisDoC));
  await pagina.keyboard.press("Escape");
  await esperar(150);
  await pagina.keyboard.press("ArrowUp");
  await esperar(200);
  const depoisDaSeta = await estadoDoEditor();
  conferir("e a seta para cima sobe para o pai", depoisDaSeta.selecionado === "conteudo", JSON.stringify(depoisDaSeta));
  await pagina.locator(".titulo").click({ position: { x: 10, y: 20 } });
  await esperar(250);
  await pagina.locator('.painel [data-campo="font-size"] input').click();
  await pagina.keyboard.press("Control+a");
  await pagina.keyboard.type("50");
  await pagina.locator(".frase").click();
  await esperar(500);
  const depoisDoClique = {
    titulo: await pagina.locator(".titulo").evaluate((e) => getComputedStyle(e).fontSize),
    selecionado: (await estadoDoEditor()).selecionado,
  };
  conferir("valor digitado e não confirmado vale para o elemento anterior quando se clica em outro", depoisDoClique.titulo === "50px" && depoisDoClique.selecionado === "frase", JSON.stringify(depoisDoClique));
  await pagina.keyboard.press("Control+z");
  await esperar(500);
  conferir("e o Ctrl+Z desfaz esse valor", (await pagina.locator(".titulo").evaluate((e) => getComputedStyle(e).fontSize)) === "48px" && !lerMudancas().some((m) => m.propriedade === "font-size"));

  const pontoLivre = (seletor) =>
    pagina.evaluate((s) => {
      const alvo = document.querySelector(s);
      const caixa = alvo.getBoundingClientRect();
      for (let y = caixa.top + 4; y < caixa.bottom - 2; y += 6) {
        for (let x = caixa.left + 4; x < caixa.right - 2; x += 12) {
          const no = document.elementFromPoint(x, y);
          if (no && (no === alvo || alvo.contains(no))) return { x, y };
        }
      }
      return null;
    }, seletor);
  const clicarLivre = async (seletor, { alt = false, duplo = false } = {}) => {
    const ponto = await pontoLivre(seletor);
    if (!ponto) throw new Error(`nenhum ponto livre em ${seletor}`);
    if (alt) await pagina.keyboard.down("Alt");
    if (duplo) await pagina.mouse.dblclick(ponto.x, ponto.y);
    else await pagina.mouse.click(ponto.x, ponto.y);
    if (alt) await pagina.keyboard.up("Alt");
    await esperar(200);
  };
  const selecionado = () => pagina.evaluate(() => {
    const atual = window.__modoRedesign.ctx.selecao.atual;
    return atual ? `${atual.localName}.${atual.classList[0] ?? ""}` : null;
  });
  conferir("a lista de atalhos do painel mostra o P", await pagina.evaluate(() => [...window.__modoRedesign.ctx.raiz.querySelectorAll(".atalhos li")].some((li) => li.textContent === "Ptoggle panel")));
  await clicarLivre(".frase", { duplo: true });
  const editandoTexto = await pagina.evaluate(() => Boolean(window.__modoRedesign.ctx.selecao.editando));
  await pagina.keyboard.press("Escape");
  await esperar(200);
  conferir("duplo clique edita o texto, e Esc sai sem gravar", editandoTexto && !(await pagina.evaluate(() => Boolean(window.__modoRedesign.ctx.selecao.editando))) && !lerMudancas().some((m) => m.tipo === "texto"));
  const caminhoDasSetas = [];
  for (const tecla of ["ArrowUp", "ArrowDown", "ArrowRight", "ArrowLeft"]) {
    await pagina.keyboard.press(tecla);
    await esperar(120);
    caminhoDasSetas.push(await selecionado());
  }
  conferir("↑ ↓ → ← andam pelo pai, o primeiro filho e os irmãos", caminhoDasSetas.join(" ") === "main.conteudo h1.titulo p.frase h1.titulo", caminhoDasSetas.join(" "));
  await clicarLivre(".frase", { alt: true });
  conferir("Alt+clique seleciona o pai", (await selecionado()) === "main.conteudo", await selecionado());
  await clicarLivre(".titulo");
  const negrito = await centroNaFerramenta('.barra [aria-label="Bold"]');
  await pagina.mouse.click(negrito.x, negrito.y);
  await esperar(400);
  await pagina.keyboard.press("c");
  await esperar(200);
  conferir("C funciona logo depois de clicar num botão da barra", await pagina.evaluate(() => Boolean(window.__modoRedesign.ctx.raiz.querySelector(".nota"))));
  await pagina.keyboard.press("Escape");
  await esperar(150);
  const tinhaNegrito = lerMudancas().some((m) => m.propriedade === "font-weight");
  await pagina.keyboard.press("Control+z");
  await esperar(500);
  conferir("Ctrl+Z desfaz o negrito", tinhaNegrito && !lerMudancas().some((m) => m.propriedade === "font-weight"));
  const cabecaDoLayout = await centroNaFerramenta('.painel .secao[data-secao="layout"] .secao-cabeca');
  await pagina.mouse.click(cabecaDoLayout.x, cabecaDoLayout.y);
  await pagina.mouse.click(cabecaDoLayout.x, cabecaDoLayout.y);
  await esperar(150);
  await pagina.keyboard.press("ArrowUp");
  await esperar(150);
  conferir("↑ funciona logo depois de clicar num botão do painel", (await selecionado()) === "main.conteudo", await selecionado());
  await clicarLivre(".titulo");
  const larguraAntesDaSeta = await pagina.evaluate(() => Math.round(window.__modoRedesign.ctx.raiz.querySelector(".painel").getBoundingClientRect().width));
  await pagina.evaluate(() => window.__modoRedesign.ctx.raiz.querySelector(".painel-alca").focus());
  await pagina.keyboard.press("ArrowLeft");
  await esperar(200);
  const larguraDepoisDaSeta = await pagina.evaluate(() => Math.round(window.__modoRedesign.ctx.raiz.querySelector(".painel").getBoundingClientRect().width));
  conferir("na borda do painel a seta muda a largura e não a seleção", larguraDepoisDaSeta === larguraAntesDaSeta + 20 && (await selecionado()) === "h1.titulo", `${larguraAntesDaSeta} -> ${larguraDepoisDaSeta}, ${await selecionado()}`);
  await pagina.keyboard.press("Enter");
  await esperar(150);
  await clicarLivre(".titulo");
  await pagina.keyboard.press("Escape");
  await esperar(150);
  const depoisDoPrimeiroEsc = { selecionado: await selecionado(), edicao: await pagina.evaluate(() => window.__modoRedesign.ctx.selecao.ativo) };
  await pagina.keyboard.press("Escape");
  await esperar(150);
  const edicaoDepoisDoSegundoEsc = await pagina.evaluate(() => window.__modoRedesign.ctx.selecao.ativo);
  conferir("Esc solta a seleção, e o segundo Esc sai da edição", depoisDoPrimeiroEsc.selecionado === null && depoisDoPrimeiroEsc.edicao && !edicaoDepoisDoSegundoEsc, `${JSON.stringify(depoisDoPrimeiroEsc)} -> edição ${edicaoDepoisDoSegundoEsc}`);
  await pagina.evaluate(() => {
    const ctx = window.__modoRedesign.ctx;
    ctx.selecao.selecionar(null);
    ctx.alternarPainel(true);
    ctx.selecao.desligar();
    ctx.raiz.activeElement?.blur();
  });
  await esperar(200);

  const titulo = pagina.locator(".titulo");
  await pagina.keyboard.press("e");
  await titulo.click({ position: { x: 10, y: 20 } });
  await esperar(200);
  conferir("clique seleciona o título", await pagina.evaluate(() => window.__modoRedesign.ctx.selecao.atual?.classList.contains("titulo")));
  await pagina.evaluate(() => {
    for (const cabeca of window.__modoRedesign.ctx.raiz.querySelectorAll(".secao.fechada .secao-cabeca")) cabeca.click();
  });
  await esperar(200);
  await varrer(pagina, "título selecionado com todas as seções abertas");
  await abrirEVarrer(pagina, ".chip-alcance", "lista de alcance");
  await abrirEVarrer(pagina, '.barra [aria-label="More options"]', "mais opções");
  await abrirEVarrer(pagina, '.painel [data-campo="width"] .modo', "modo da largura");
  await abrirEVarrer(pagina, '.painel [data-campo="font-weight"] .botao-lista', "peso");
  await abrirEVarrer(pagina, '.painel [data-campo="font-family"] .botao-lista', "fontes");
  await abrirEVarrer(pagina, '.painel [data-campo="box-shadow"] .modo', "sombras prontas");
  await abrirEVarrer(pagina, '.barra [aria-label="Make it a link"]', "nota de link");
  await pagina.keyboard.press("c");
  await esperar(200);
  await varrer(pagina, "comentário");
  await pagina.keyboard.press("Escape");
  await esperar(120);
  await pagina.evaluate(() => window.__modoRedesign.ctx.raiz.querySelector('.barra [aria-label="More options"]').click());
  await esperar(200);
  await pagina.evaluate(() => [...window.__modoRedesign.ctx.raiz.querySelectorAll(".opcao")].find((opcao) => opcao.textContent.includes("Copy selector"))?.click());
  await esperar(300);
  const copia = await pagina.evaluate(async () => ({
    aviso: window.__modoRedesign.ctx.raiz.querySelector(".aviso").textContent,
    area: await navigator.clipboard.readText().catch((erro) => `ilegível: ${erro.message}`),
    seletor: window.__modoRedesign.ctx.alvoAtual()?.seletor,
  }));
  conferir("copiar o seletor põe o seletor na área de transferência e só então diz que copiou", copia.aviso === "Selector copied." && copia.area === copia.seletor, JSON.stringify(copia));
  await varrer(pagina, "aviso de seletor copiado");
  const tamanho = pagina.locator('.barra [data-campo="font-size"] input');
  await tamanho.fill("64");
  await tamanho.press("Enter");
  await esperar(150);
  conferir("a edição vence a regra de especificidade alta", (await titulo.evaluate((e) => getComputedStyle(e).fontSize)) === "64px");
  await esperar(600);
  const doTamanho = lerMudancas().find((m) => m.propriedade === "font-size");
  conferir("mudança gravada com a regra de origem", doTamanho?.regras?.[0]?.origem === "/estilo.css" && doTamanho?.regras?.[0]?.vence === true, JSON.stringify(doTamanho?.regras?.[0] ?? {}));
  conferir("o valor de antes é o escrito na regra", doTamanho?.antes === "48px", doTamanho?.antes);

  await pagina.keyboard.press("Control+z");
  await esperar(500);
  conferir("Ctrl+Z volta o valor e tira do arquivo", (await titulo.evaluate((e) => getComputedStyle(e).fontSize)) === "48px" && !lerMudancas().some((m) => m.propriedade === "font-size"));
  await pagina.keyboard.press("Control+Shift+z");
  await esperar(500);
  conferir("Ctrl+Shift+Z refaz", (await titulo.evaluate((e) => getComputedStyle(e).fontSize)) === "64px");
  await pagina.keyboard.press("Escape");

  const frase = pagina.locator(".frase");
  await frase.click();
  await esperar(200);
  const seloDoToken = pagina.locator('.painel [data-campo="color"] .selo-token');
  conferir("cor vinda de token mostra o nome do token", (await seloDoToken.textContent())?.includes("texto"), await seloDoToken.textContent());
  await pagina.locator('.painel [data-campo="color"] .amostra').click();
  await esperar(250);
  await varrer(pagina, "seletor de cor de um token");
  const hexDoSeletor = pagina.locator(".seletor-de-cor .hex");
  await hexDoSeletor.fill("ff0000");
  await hexDoSeletor.press("Enter");
  await pagina.keyboard.press("Escape");
  await esperar(500);
  const daCor = lerMudancas().find((m) => m.propriedade === "color");
  conferir("cor fica presa ao tema em que foi feita", daCor?.escopoDeTema === 'html[data-theme="escuro"]', daCor?.escopoDeTema);
  conferir("cor aplicada no tema escuro", (await frase.evaluate((e) => getComputedStyle(e).color)) === "rgb(255, 0, 0)");
  await pagina.evaluate(() => (document.documentElement.dataset.theme = "claro"));
  await esperar(100);
  conferir("no tema claro a cor do escuro não vale", (await frase.evaluate((e) => getComputedStyle(e).color)) !== "rgb(255, 0, 0)");
  await pagina.evaluate(() => (document.documentElement.dataset.theme = "escuro"));
  await pagina.keyboard.press("Escape");

  const cartoes = pagina.locator(".cartao-titulo");
  await cartoes.nth(1).click();
  await esperar(200);
  await pagina.locator(".painel .seg.alcance .seg-opcao", { hasText: "Only this" }).click();
  await esperar(150);
  await tamanho.fill("30");
  await tamanho.press("Enter");
  await esperar(200);
  const tamanhos = await cartoes.evaluateAll((lista) => lista.map((e) => getComputedStyle(e).fontSize));
  conferir("Só este muda só o elemento escolhido", tamanhos.join(",") === "18px,30px,18px", tamanhos.join(","));
  await varrer(pagina, "alcance só este");
  await pagina.keyboard.press("Escape");

  await pagina.evaluate(() => window.__modoRedesign.ctx.selecao.selecionar(document.querySelector(".cartoes")));
  await esperar(200);
  await varrer(pagina, "caixa flex");
  await pagina.evaluate(() => window.__modoRedesign.ctx.selecao.selecionar(document.querySelector(".grade")));
  await esperar(200);
  await varrer(pagina, "grade posicionada");
  await pagina.keyboard.press("Escape");

  const cartao = pagina.locator(".cartao").nth(2);
  await cartao.click({ position: { x: 4, y: 4 } });
  await esperar(200);
  const medidasDoPainel = await pagina.evaluate(() => {
    const raiz = window.__modoRedesign.ctx.raiz;
    return {
      largura: Math.round(raiz.querySelector(".painel").getBoundingClientRect().width),
      campo: Math.round(raiz.querySelector('.painel [data-campo="width"]').getBoundingClientRect().height),
    };
  });
  conferir("painel abre com 360 px e campos de 32 px", medidasDoPainel.largura === 360 && medidasDoPainel.campo === 32, JSON.stringify(medidasDoPainel));
  const opacidade = pagina.locator('.painel [data-campo="opacity"] input');
  await opacidade.focus();
  await pagina.keyboard.press("ArrowDown");
  await esperar(150);
  conferir("seta na opacidade vai de 100% a 99%", (await cartao.evaluate((e) => getComputedStyle(e).opacity)) === "0.99", await opacidade.inputValue());
  await opacidade.fill("50");
  await opacidade.press("Enter");
  await esperar(600);
  const daOpacidade = lerMudancas().find((m) => m.propriedade === "opacity");
  conferir("a transição do elemento não engole a edição", daOpacidade?.depois === "0.5" && daOpacidade?.depoisCalculado?.[0] === "0.5", JSON.stringify(daOpacidade?.depoisCalculado ?? null));
  await pagina.keyboard.press("Escape");
  const alca = await pagina.evaluate(() => {
    const caixa = window.__modoRedesign.ctx.raiz.querySelector(".painel-alca").getBoundingClientRect();
    return { x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 };
  });
  await pagina.mouse.move(alca.x, alca.y);
  await pagina.mouse.down();
  await pagina.mouse.move(alca.x - 80, alca.y, { steps: 5 });
  await pagina.mouse.up();
  await esperar(200);
  const larguraArrastada = await pagina.evaluate(() => Math.round(window.__modoRedesign.ctx.raiz.querySelector(".painel").getBoundingClientRect().width));
  conferir("arrastar a borda do painel alarga 80 px", larguraArrastada === 440, larguraArrastada);
  await pagina.mouse.dblclick(alca.x - 80, alca.y);
  await esperar(200);
  conferir("duplo clique na borda volta aos 360 px", (await pagina.evaluate(() => Math.round(window.__modoRedesign.ctx.raiz.querySelector(".painel").getBoundingClientRect().width))) === 360);
  await pagina.keyboard.press("Escape");

  const enderecoAntes = pagina.url();
  await pagina.locator(".enviar").click();
  await esperar(400);
  conferir("no modo de edição o formulário não é enviado", pagina.url() === enderecoAntes);

  await frase.dblclick();
  await esperar(200);
  await pagina.keyboard.press("Control+a");
  await pagina.keyboard.type("Frase nova escrita no lugar");
  await pagina.keyboard.press("Enter");
  await esperar(600);
  const doTexto = lerMudancas().find((m) => m.tipo === "texto");
  conferir("edição de texto gravada", doTexto?.depois === "Frase nova escrita no lugar", doTexto?.depois);
  await pagina.keyboard.press("Escape");
  await abrirEVarrer(pagina, '.dock-botao[aria-label="Changes"]', "lista de mudanças");

  await pagina.keyboard.press("e");
  await pagina.locator(".abrir-modal").click();
  await esperar(200);
  await pagina.keyboard.press("e");
  await esperar(200);
  conferir("editor entra no modal aberto", await pagina.evaluate(() => document.querySelector(".modal > redesign-editor") !== null));
  await pagina.locator(".modal-titulo").click();
  await esperar(200);
  await tamanho.fill("28");
  await tamanho.press("Enter");
  await esperar(200);
  conferir("dá para editar dentro do modal", (await pagina.locator(".modal-titulo").evaluate((e) => getComputedStyle(e).fontSize)) === "28px");
  await pagina.keyboard.press("Escape");
  await pagina.keyboard.press("Escape");
  await esperar(150);
  conferir("Esc não fecha o modal do site", await pagina.evaluate(() => document.querySelector(".modal").open));
  await pagina.evaluate(() => document.querySelector(".modal").close());
  await esperar(250);
  conferir("editor volta ao html quando o modal fecha", await pagina.evaluate(() => document.querySelector("html > redesign-editor") !== null));

  await pagina.locator(".dock-botao.claude").click();
  conferir("o botão Claude chega no escutar", Boolean(await esperarLinha(escuta, /PEDIDO DO EDITOR/, 5000)));
  const pendentes = cli("pendentes");
  conferir("pendentes lista a regra e o arquivo", /\/estilo\.css/.test(pendentes.stdout) && /VENCE/.test(pendentes.stdout));

  const deTamanho = lerMudancas().find((m) => m.propriedade === "font-size" && m.alvo?.seletor?.includes("titulo") && !m.alvo.seletor.includes("cartao") && !m.alvo.seletor.includes("modal"));
  const css = fs.readFileSync(path.join(pastaDoSite, "estilo.css"), "utf8");
  fs.writeFileSync(path.join(pastaDoSite, "estilo.css"), css.replace("font-size: 48px;", "font-size: 64px;"));
  await esperar(900);
  const marcou = cli("aplicadas", deTamanho.id, "--nota", "font-size do título no estilo.css");
  conferir("aplicadas marca pelo comando", /1 de 1/.test(marcou.stdout), marcou.stdout.trim() || marcou.stderr.trim());
  conferir("com o CSS mudado de verdade, chega CONFERIDA", Boolean(await esperarLinha(escuta, new RegExp(`CONFERIDA ${deTamanho.id}`), 15000)));

  cli("aplicadas", daCor.id);
  conferir("CONTROLE NEGATIVO: cor marcada sem mudar o CSS chega DIVERGENTE", Boolean(await esperarLinha(escuta, new RegExp(`DIVERGENTE ${daCor.id}`), 18000)));
  cli("aplicadas", doTexto.id);
  conferir("CONTROLE NEGATIVO: texto marcado sem mudar o HTML chega DIVERGENTE", Boolean(await esperarLinha(escuta, new RegExp(`DIVERGENTE ${doTexto.id}`), 22000)));

  escuta.kill();
  let apagou = false;
  for (let i = 0; i < 20 && !apagou; i++) {
    await esperar(150);
    apagou = (await estadoDaPresenca()) === "ausente";
  }
  const dicaDoClaude = await pagina.evaluate(() => window.__modoRedesign.ctx.raiz.querySelector(".dock-botao.claude").dataset.dica);
  conferir("o escutar caiu: o ponto apaga e a dica manda pedir no terminal", apagou && /isn't listening/.test(dicaDoClaude), dicaDoClaude);

  fs.appendFileSync(path.join(copiaDosScripts, "editor", "editor.css"), "\n");
  let avisou = false;
  for (let i = 0; i < 40 && !avisou; i++) {
    await esperar(150);
    avisou = await avisoDeVersaoVisivel(pagina);
  }
  conferir("o editor mudou no disco: a aba aberta pede recarga", avisou);
  await varrer(pagina, "aviso de versão");
  conferir("a interface do editor está toda em inglês e sem null", ofensasDeIdioma.length === 0, `${ofensasDeIdioma.length}: ${ofensasDeIdioma.slice(0, 4).join(" | ")}`);

  conferir("console sem erro", erros.length === 0, erros.slice(0, 3).join(" | "));

  const cartaoDeConexaoVisivel = () => pagina.evaluate(() => !window.__modoRedesign.ctx.raiz.querySelector(".aviso-conexao").classList.contains("oculto"));
  conferir("com o servidor no ar, nenhum cartão de conexão", !(await cartaoDeConexaoVisivel()));
  proxy.kill();
  await esperar(700);
  const cedo = await cartaoDeConexaoVisivel();
  await esperar(2600);
  conferir("servidor caiu: o cartão aparece depois de 2 s, e não pisca antes", !cedo && (await cartaoDeConexaoVisivel()), `aos 0,7 s: ${cedo}`);
  await navegador.close();
} catch (erro) {
  console.log(`XX  a prova parou: ${erro.message}`);
  falhas++;
}

console.log(falhas ? `${falhas} FALHAS` : "TUDO VERDE");
await encerrar(falhas ? 1 : 0);
