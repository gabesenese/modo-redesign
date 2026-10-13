import { BASE, criarBarramento, ehCampoDeTexto, contar } from "./utilitarios.js";
import {
  descreverAlvo,
  regrasQueCasam,
  regrasDaPropriedade,
  nomesDeTokens,
  seletoresQueDeclaram,
  prepararOrigens,
  registrarFolhaDoEditor,
} from "./elementos.js";
import { ehCor, hexDe, rgbaDe } from "./cor.js";
import { criarLoja } from "./loja.js";
import { criarTopo } from "./topo.js";
import { criarEdicao } from "./edicao.js";
import { criarSelecao } from "./selecao.js";
import { criarBarra } from "./barra.js";
import { criarPainel } from "./painel.js";
import { criarDock } from "./dock.js";
import { criarNotas } from "./notas.js";
import { primeiraFonte } from "./campos.js";

const VERSAO_DO_EDITOR = new URL(import.meta.url).searchParams.get("v") ?? "";

const SUGESTOES_DE_FONTE = [
  ["Inter", "sans-serif"],
  ["Geist", "sans-serif"],
  ["Instrument Sans", "sans-serif"],
  ["DM Sans", "sans-serif"],
  ["Manrope", "sans-serif"],
  ["Plus Jakarta Sans", "sans-serif"],
  ["IBM Plex Sans", "sans-serif"],
  ["Space Grotesk", "sans-serif"],
  ["Figtree", "sans-serif"],
  ["Onest", "sans-serif"],
  ["Fraunces", "serif"],
  ["Newsreader", "serif"],
  ["Source Serif 4", "serif"],
  ["Playfair Display", "serif"],
  ["Geist Mono", "monospace"],
  ["JetBrains Mono", "monospace"],
  ["IBM Plex Mono", "monospace"],
];

async function iniciar() {
  const host = document.createElement("redesign-editor");
  host.setAttribute("data-redesign", "");
  host.setAttribute("lang", "en");
  host.style.cssText = "all: initial !important; display: contents !important;";
  const raiz = host.attachShadow({ mode: "open" });
  const css = await fetch(`${BASE}editor/editor.css`, { cache: "no-store" }).then((resposta) => resposta.text());
  const folhaDaFerramenta = new CSSStyleSheet();
  folhaDaFerramenta.replaceSync(css);
  raiz.adoptedStyleSheets = [folhaDaFerramenta];
  document.documentElement.append(host);

  const barramento = criarBarramento();
  const ctx = { host, raiz, emitir: barramento.emitir, ouvir: barramento.ouvir, versaoDoEditor: VERSAO_DO_EDITOR };
  window.__modoRedesign.ctx = ctx;
  window.__modoRedesign.editor = VERSAO_DO_EDITOR;

  let alcance = "todos";
  let alvoAtual = null;
  let casadas = null;
  const declarados = new Map();
  const folhaDeFontes = new CSSStyleSheet();
  const fontesCarregadas = new Map();
  const folhaDaFonteDoEditor = new CSSStyleSheet();
  folhaDaFonteDoEditor.replaceSync(
    `@font-face{font-family:"Redesign Geist";src:url("${BASE}editor/geist.woff2") format("woff2");font-weight:100 900;font-display:swap}` +
      `@font-face{font-family:"Redesign Geist Mono";src:url("${BASE}editor/geist-mono.woff2") format("woff2");font-weight:100 900;font-display:swap}`,
  );
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, folhaDaFonteDoEditor];

  ctx.ouvir("selecao", (elemento) => {
    alcance = "todos";
    casadas = null;
    declarados.clear();
    alvoAtual = elemento ? descreverAlvo(elemento, alcance) : null;
    ctx.topo?.fecharPop();
  });
  ctx.ouvir("mudancas", () => declarados.clear());

  ctx.alcance = () => alcance;
  ctx.alvoAtual = () => alvoAtual;
  ctx.alvoPara = (elemento, qual) => descreverAlvo(elemento, qual);
  ctx.definirAlcance = (novo) => {
    alcance = novo === "este" ? "este" : "todos";
    alvoAtual = ctx.selecao.atual ? descreverAlvo(ctx.selecao.atual, alcance) : null;
    ctx.emitir("alcance", alcance);
  };
  ctx.declarado = (propriedade) => {
    const alvo = ctx.selecao.atual;
    if (!alvo) return null;
    if (!declarados.has(propriedade)) {
      casadas ??= regrasQueCasam(alvo);
      declarados.set(propriedade, regrasDaPropriedade(alvo, propriedade, casadas).find((regra) => regra.vence)?.valor ?? null);
    }
    return declarados.get(propriedade);
  };
  ctx.tokensDeCor = (elemento) => {
    const alvo = elemento ?? document.documentElement;
    const estilo = getComputedStyle(alvo);
    return nomesDeTokens()
      .map((nome) => ({ nome, valor: estilo.getPropertyValue(nome).trim() }))
      .filter((token) => token.valor && ehCor(token.valor, alvo))
      .map((token) => ({ ...token, hex: hexDe(token.valor, alvo) ?? token.valor }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  };
  ctx.alvoDoToken = (token) => {
    const seletores = seletoresQueDeclaram(token);
    const seletor = seletores.length ? seletores.join(", ") : ":root";
    const dono = document.querySelector(seletores[0] ?? ":root") ?? document.documentElement;
    return { dono, alvo: { ...descreverAlvo(dono, "todos"), seletor, quantos: contar(seletor), elemento: `token ${token}`, componentes: [] } };
  };
  ctx.mudarToken = (token, valor, opcoes = {}) => {
    const { dono, alvo } = ctx.alvoDoToken(token);
    const atual = getComputedStyle(dono).getPropertyValue(token).trim();
    const trinca = /^(\d{1,3})(\s*,\s*|\s+)(\d{1,3})\2(\d{1,3})$/.exec(atual);
    const rgba = trinca ? rgbaDe(valor, dono) : null;
    const final = rgba ? rgba.slice(0, 3).join(trinca[2]) : valor;
    return ctx.edicao.estilo(token, final, { elemento: dono, alvo, ...opcoes });
  };
  ctx.fontes = () => {
    const vistas = new Map();
    const amostra = [document.body, ...document.querySelectorAll("h1, h2, h3, p, a, button, label, input, code")].slice(0, 300);
    for (const elemento of amostra) {
      const nome = primeiraFonte(getComputedStyle(elemento).fontFamily);
      if (nome && !nome.startsWith("Redesign ") && !vistas.has(nome)) vistas.set(nome, "on page");
    }
    for (const par of ctx.loja.config.tipografia?.pares ?? []) {
      for (const nome of [par.titulo, par.texto, par.mono]) if (nome && !vistas.has(nome)) vistas.set(nome, "project");
    }
    const lista = [...vistas].map(([nome, origem]) => ({ nome, origem }));
    for (const [nome, generica] of SUGESTOES_DE_FONTE) if (!vistas.has(nome)) lista.push({ nome, origem: "Google Fonts", generica });
    return lista;
  };
  ctx.carregarFonte = async (nome, { silencioso = false } = {}) => {
    if (!nome) return false;
    if (fontesCarregadas.has(nome)) return fontesCarregadas.get(nome);
    const existe = [...document.fonts].some((face) => face.family.replace(/["']/g, "") === nome);
    if (existe) {
      fontesCarregadas.set(nome, false);
      return false;
    }
    const tentativa = (async () => {
      const familia = nome.trim().replace(/\s+/g, "+");
      for (const eixo of [":ital,wght@0,100..900;1,100..900", ":wght@100..900", ":wght@400;500;600;700", ""]) {
        try {
          const resposta = await fetch(`https://fonts.googleapis.com/css2?family=${familia}${eixo}&display=swap`);
          if (!resposta.ok) continue;
          const css = await resposta.text();
          const atual = [...folhaDeFontes.cssRules].map((regra) => regra.cssText).join("\n");
          folhaDeFontes.replaceSync(`${atual}\n${css}`);
          if (!document.adoptedStyleSheets.includes(folhaDeFontes)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, folhaDeFontes];
          await document.fonts.load(`16px "${nome}"`).catch(() => {});
          return true;
        } catch {}
      }
      if (!silencioso) ctx.emitir("aviso", { texto: `Couldn't find the font "${nome}" on Google Fonts.`, tipo: "erro" });
      return false;
    })();
    fontesCarregadas.set(nome, tentativa);
    const resultado = await tentativa;
    fontesCarregadas.set(nome, resultado);
    return resultado;
  };

  ctx.topo = criarTopo(ctx);
  ctx.loja = criarLoja(ctx);
  registrarFolhaDoEditor(ctx.loja.folha);
  registrarFolhaDoEditor(folhaDeFontes);
  registrarFolhaDoEditor(folhaDaFonteDoEditor);
  ctx.edicao = criarEdicao(ctx);
  ctx.selecao = criarSelecao(ctx);
  ctx.destacar = (elemento) => ctx.selecao.destacar(elemento);
  ctx.painel = criarPainel(ctx);
  ctx.painelAberto = () => ctx.painel.aberto;
  ctx.alternarPainel = (forcar) => ctx.painel.alternar(forcar);
  ctx.abrirOuFecharPainel = () => {
    if (ctx.selecao.ativo) return ctx.alternarPainel();
    ctx.selecao.ligar();
    ctx.alternarPainel(true);
  };
  ctx.larguraDoPainel = () => ctx.painel.largura();
  ctx.notas = criarNotas(ctx);
  ctx.abrirNota = (opcoes) => ctx.notas.abrir(opcoes);
  ctx.barra = criarBarra(ctx);
  ctx.dock = criarDock(ctx);

  function consumir(evento) {
    evento.preventDefault();
    evento.stopImmediatePropagation();
  }

  raiz.addEventListener("input", (evento) => evento.target.dataset && (evento.target.dataset.sujo = "1"), true);
  const limparSujeira = (evento) => evento.target?.dataset && delete evento.target.dataset.sujo;
  raiz.addEventListener("change", limparSujeira, true);
  raiz.addEventListener("focusin", limparSujeira, true);
  raiz.addEventListener("keyup", (evento) => evento.key === "Enter" && limparSujeira(evento), true);

  window.addEventListener(
    "keydown",
    (evento) => {
      if (ctx.selecao.editando) return;
      const caminho = evento.composedPath();
      const naSelecao = caminho[0]?.classList?.contains("caixa-atual");
      const dentro = caminho.includes(host) && !naSelecao;
      const campoNosso = dentro && ehCampoDeTexto(caminho[0]) ? caminho[0] : null;
      const tecla = evento.key.toLowerCase();
      const semModificador = !evento.ctrlKey && !evento.metaKey && !evento.altKey;
      const comando = (evento.ctrlKey || evento.metaKey) && !evento.altKey;
      if (evento.key === "Escape") {
        if (campoNosso && campoNosso.dataset.sujo !== "1" && !campoNosso.closest(".pop")) {
          consumir(evento);
          campoNosso.blur();
          ctx.selecao.focarSelecao();
          return;
        }
        if (ctx.topo.popAberto()) {
          consumir(evento);
          ctx.topo.fecharPop(true);
          return;
        }
        if (campoNosso) return;
        if (!ctx.selecao.ativo) return;
        consumir(evento);
        if (ctx.selecao.atual) ctx.selecao.selecionar(null);
        else ctx.selecao.desligar();
        return;
      }
      if (campoNosso && campoNosso.dataset.sujo !== "1" && ctx.selecao.ativo && comando && (tecla === "z" || tecla === "y")) {
        consumir(evento);
        if (tecla === "y" || evento.shiftKey) ctx.loja.refazer();
        else ctx.loja.desfazer();
        return;
      }
      if (dentro ? ehCampoDeTexto(caminho[0]) : ehCampoDeTexto(evento.target)) return;
      if (semModificador && tecla === "e" && !evento.repeat) {
        consumir(evento);
        ctx.selecao.alternar();
        return;
      }
      if (semModificador && tecla === "p" && !evento.repeat) {
        consumir(evento);
        ctx.abrirOuFecharPainel();
        return;
      }
      if (!ctx.selecao.ativo) return;
      if (comando && tecla === "z") {
        consumir(evento);
        if (evento.shiftKey) ctx.loja.refazer();
        else ctx.loja.desfazer();
        return;
      }
      if (comando && tecla === "y") {
        consumir(evento);
        ctx.loja.refazer();
        return;
      }
      if (!ctx.selecao.atual) return;
      const controleUsaATecla = dentro && Boolean(caminho[0]?.closest?.('.pop, [role="separator"]'));
      const direcoes = { arrowup: "pai", arrowdown: "filho", arrowleft: "anterior", arrowright: "proximo" };
      if (semModificador && direcoes[tecla] && !controleUsaATecla) {
        consumir(evento);
        ctx.selecao.andar(direcoes[tecla]);
      } else if (semModificador && tecla === "c" && !controleUsaATecla) {
        consumir(evento);
        const ancora = ctx.barra.botaoComentario.offsetParent ? ctx.barra.botaoComentario : ctx.barra.elemento;
        ctx.abrirNota({ tipo: "comentario", ancora });
      } else if (!dentro && semModificador && tecla === "enter") {
        consumir(evento);
        ctx.selecao.editarTexto();
      } else if (!dentro && semModificador && tecla === "tab") {
        consumir(evento);
        ctx.barra.focar();
      }
    },
    true,
  );

  let ultimaPagina = location.pathname;
  setInterval(() => {
    if (location.pathname === ultimaPagina) return;
    ultimaPagina = location.pathname;
    ctx.selecao.selecionar(null);
    ctx.loja.renderizar();
    ctx.loja.conferirAplicadas();
    prepararOrigens();
  }, 400);
  addEventListener("resize", () => ctx.emitir("mudancas", ctx.loja.vista()));

  await ctx.loja.carregar();
  prepararOrigens();
  setTimeout(prepararOrigens, 3000);
}

if (!window.__modoRedesign) {
  window.__modoRedesign = { versao: 1 };
  iniciar().catch((erro) => console.error("[redesign mode] failed to start", erro));
}
