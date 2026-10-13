import { BASE, todos, primeiro, valorSeguro, propriedadeSegura } from "./utilitarios.js";
import { marcaDeTema } from "./elementos.js";

const ABERTAS = new Set(["pendente", "divergente"]);

export function seletorComTema(seletor, tema) {
  if (!seletor) return null;
  if (!tema || seletor.includes("::")) return seletor;
  return `:is(${seletor}):where(${tema}, ${tema} *)`;
}

export function ehAberta(mudanca) {
  return ABERTAS.has(mudanca?.situacao);
}

function aplicarOps(estado, ops) {
  let mudancas = estado.mudancas.slice();
  for (const op of ops) {
    if (op.op === "definir") {
      const nova = op.mudanca;
      const i = mudancas.findIndex((m) => m.chave === nova.chave && ABERTAS.has(m.situacao));
      if (i >= 0) {
        const atual = mudancas[i];
        mudancas[i] = {
          ...atual,
          ...nova,
          id: atual.id,
          antes: atual.antes,
          antesCalculado: atual.antesCalculado ?? nova.antesCalculado,
          situacao: "pendente",
          conferencia: null,
        };
      } else mudancas.push({ ...nova, situacao: "pendente" });
    } else if (op.op === "remover") {
      const ids = new Set([op.ids ?? [], op.id ?? []].flat());
      mudancas = mudancas.filter((m) => !(ids.has(m.id) && ABERTAS.has(m.situacao)));
    } else if (op.op === "limpar") {
      mudancas = mudancas.filter((m) => !ABERTAS.has(m.situacao));
    }
  }
  return { ...estado, mudancas };
}

function trocarTexto(elemento, texto) {
  const nos = [...elemento.childNodes];
  if (nos.length && nos.every((no) => no.nodeType === 3)) {
    nos[0].data = texto;
    for (const no of nos.slice(1)) no.data = "";
  } else elemento.textContent = texto;
}

export function criarLoja(ctx) {
  let confirmado = { versao: 0, mudancas: [] };
  let fila = [];
  let emVoo = [];
  let enviando = false;
  let temporizador = null;
  let falhasSeguidas = 0;
  let vista = confirmado;
  let config = {};
  let projeto = {};
  const passosParaDesfazer = [];
  const passosParaRefazer = [];
  const folha = new CSSStyleSheet();
  const emConferencia = new Set();
  const textosTrocados = new Map();

  function instalarFolha() {
    if (!document.adoptedStyleSheets.includes(folha)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, folha];
  }

  function recalcular() {
    vista = aplicarOps(aplicarOps(confirmado, emVoo), fila);
    renderizar();
    ctx.emitir("mudancas", vista);
  }

  function renderizar() {
    instalarFolha();
    const regras = [];
    for (const m of vista.mudancas) {
      if (m.tipo !== "estilo" || !ABERTAS.has(m.situacao) || !propriedadeSegura(m.propriedade)) continue;
      if (m.alvo?.alcance === "este" && m.pagina && m.pagina !== location.pathname) continue;
      const seletor = seletorComTema(m.alvo?.seletor, m.escopoDeTema);
      if (seletor) regras.push(`${seletor}{${m.propriedade}:${valorSeguro(m.depois)} !important}`);
    }
    try {
      folha.replaceSync(`@layer redesign{\n${regras.join("\n")}\n}`);
    } catch (erro) {
      console.warn("[redesign mode] overlay rejected", erro);
    }
    aplicarTextos();
  }

  function aplicarTextos() {
    const abertos = new Set();
    for (const m of vista.mudancas) {
      if (m.tipo !== "texto" || !ABERTAS.has(m.situacao)) continue;
      if (m.pagina && m.pagina !== location.pathname) continue;
      abertos.add(m.id);
      const elemento = primeiro(m.alvo?.seletor);
      if (!elemento || ctx.selecao?.editando === elemento) continue;
      if (elemento.textContent === m.antes) {
        trocarTexto(elemento, m.depois);
        textosTrocados.set(m.id, { elemento, antes: m.antes, depois: m.depois });
      } else if (elemento.textContent === m.depois) textosTrocados.set(m.id, { elemento, antes: m.antes, depois: m.depois });
    }
    for (const [id, troca] of textosTrocados) {
      if (abertos.has(id)) continue;
      const mudanca = vista.mudancas.find((m) => m.id === id);
      if (!mudanca && troca.elemento.isConnected && troca.elemento.textContent === troca.depois) trocarTexto(troca.elemento, troca.antes);
      textosTrocados.delete(id);
    }
  }

  async function carregar() {
    const resposta = await fetch(`${BASE}api/estado`, { cache: "no-store" });
    const dados = await resposta.json();
    confirmado = { versao: dados.versao ?? 0, mudancas: dados.mudancas ?? [] };
    config = dados.config ?? {};
    projeto = dados.projeto ?? {};
    recalcular();
    conectar();
    setTimeout(conferirAplicadas, 600);
  }

  function conectar() {
    const fonte = new EventSource(`${BASE}api/eventos`);
    fonte.addEventListener("estado", (evento) => {
      const dados = JSON.parse(evento.data);
      if ((dados.versao ?? 0) < confirmado.versao) return;
      confirmado = dados;
      recalcular();
      conferirAplicadas();
    });
    fonte.addEventListener("editor", (evento) => {
      const { versao } = JSON.parse(evento.data);
      if (versao && versao !== ctx.versaoDoEditor) ctx.emitir("editorNovo", versao);
    });
    fonte.addEventListener("claude", (evento) => ctx.emitir("claude", (JSON.parse(evento.data).ouvindo ?? 0) > 0));
    fonte.addEventListener("open", () => ctx.emitir("conexao", true));
    fonte.addEventListener("error", () => ctx.emitir("conexao", false));
  }

  async function postar(corpo) {
    const resposta = await fetch(`${BASE}api/operacao`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-redesign": "1" },
      body: JSON.stringify(corpo),
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro ?? `response ${resposta.status}`);
    return dados;
  }

  function enfileirar(op) {
    if (op.op === "definir") {
      const i = fila.findIndex((item) => item.op === "definir" && item.mudanca.chave === op.mudanca.chave);
      if (i >= 0) fila[i] = op;
      else fila.push(op);
    } else fila.push(op);
    recalcular();
    clearTimeout(temporizador);
    temporizador = setTimeout(despachar, 160);
  }

  async function despachar() {
    if (enviando || !fila.length) return;
    enviando = true;
    emVoo = fila;
    fila = [];
    try {
      const dados = await postar({ op: "lote", ops: emVoo });
      if (dados.estado && (dados.estado.versao ?? 0) >= confirmado.versao) confirmado = dados.estado;
      falhasSeguidas = 0;
      emVoo = [];
    } catch (erro) {
      falhasSeguidas++;
      fila = [...emVoo, ...fila];
      emVoo = [];
      ctx.emitir("aviso", { texto: `Couldn't save the change (${erro.message}). Retrying.`, tipo: "erro" });
    } finally {
      enviando = false;
      recalcular();
      if (fila.length) temporizador = setTimeout(despachar, falhasSeguidas ? Math.min(8000, 1000 * 2 ** falhasSeguidas) : 160);
    }
  }

  function registrarPasso(itens) {
    const agora = Date.now();
    const ultimo = passosParaDesfazer.at(-1);
    if (
      ultimo &&
      itens.length === 1 &&
      ultimo.itens.length === 1 &&
      ultimo.itens[0].chave === itens[0].chave &&
      agora - ultimo.quando < 900
    ) {
      ultimo.itens[0].posterior = itens[0].posterior;
      ultimo.quando = agora;
    } else passosParaDesfazer.push({ itens, quando: agora });
    if (passosParaDesfazer.length > 200) passosParaDesfazer.shift();
    passosParaRefazer.length = 0;
    ctx.emitir("historico");
  }

  function restaurar(destino, atual) {
    if (destino) enfileirar({ op: "definir", mudanca: destino });
    else if (atual) enfileirar({ op: "remover", id: atual.id });
  }

  function desfazer() {
    const passo = passosParaDesfazer.pop();
    if (!passo) return false;
    for (const item of [...passo.itens].reverse()) restaurar(item.anterior, item.posterior);
    passosParaRefazer.push(passo);
    ctx.emitir("historico");
    return true;
  }

  function refazer() {
    const passo = passosParaRefazer.pop();
    if (!passo) return false;
    for (const item of passo.itens) restaurar(item.posterior, item.anterior);
    passosParaDesfazer.push(passo);
    ctx.emitir("historico");
    return true;
  }

  async function esvaziar() {
    clearTimeout(temporizador);
    const limite = Date.now() + 5000;
    while ((fila.length || emVoo.length || enviando) && Date.now() < limite) {
      if (!enviando && fila.length) await despachar();
      else await new Promise((resolver) => setTimeout(resolver, 60));
    }
    if (fila.length || emVoo.length) throw new Error("a change is still unsaved");
  }

  async function enviarDireto(op) {
    try {
      await postar(op);
    } catch (erro) {
      console.warn("[redesign mode]", op.op, erro);
    }
  }

  function medirSeletor(seletor, propriedade, escopo, { semTransicao = false } = {}) {
    const elementos = todos(seletorComTema(seletor, escopo)).slice(0, 20);
    if (semTransicao) {
      for (const elemento of elementos) {
        for (const animacao of elemento.getAnimations?.() ?? []) {
          if ("transitionProperty" in animacao) animacao.finish();
        }
      }
    }
    return elementos.map((elemento) => getComputedStyle(elemento).getPropertyValue(propriedade).trim());
  }

  function chaveDaConferencia(m) {
    return `${m.id}@${m.aplicadaEm ?? ""}`;
  }

  function conferirEstilo(m) {
    if (m.escopoDeTema && m.escopoDeTema !== marcaDeTema(config)) return;
    if (m.alvo?.alcance === "este" && m.pagina && m.pagina !== location.pathname) return;
    const naPagina = m.pagina === location.pathname;
    if (!naPagina && !todos(m.alvo?.seletor).length) return;
    emConferencia.add(chaveDaConferencia(m));
    const esperado = Array.isArray(m.depoisCalculado) ? m.depoisCalculado : [];
    const inicio = Date.now();
    const tentar = () => {
      const medido = medirSeletor(m.alvo?.seletor, m.propriedade, m.escopoDeTema);
      const comparaveis = Math.min(esperado.length, medido.length);
      const diferentes = medido.slice(0, comparaveis).filter((valor, i) => valor !== esperado[i]).length;
      if (comparaveis > 0 && diferentes === 0) {
        return enviarDireto({ op: "conferida", id: m.id, conferencia: { esperado: esperado[0], medido: medido[0], elementos: comparaveis } });
      }
      if (Date.now() - inicio > 12000) {
        const motivo = medido.length ? null : "the selector no longer matches any element on this page";
        return enviarDireto({
          op: "divergente",
          id: m.id,
          conferencia: { esperado: esperado[0] ?? null, medido: medido[0] ?? null, diferentes, elementos: comparaveis, motivo },
        });
      }
      setTimeout(tentar, 300);
    };
    setTimeout(tentar, 250);
  }

  async function conferirTexto(m) {
    if (m.pagina && m.pagina !== location.pathname) return;
    emConferencia.add(chaveDaConferencia(m));
    const normal = (texto) => String(texto ?? "").replace(/\s+/g, " ").trim();
    const inicio = Date.now();
    while (Date.now() - inicio < 15000) {
      try {
        const html = await fetch(location.href, { headers: { accept: "text/html" }, cache: "no-store" }).then((r) => r.text());
        const corpo = new DOMParser().parseFromString(html, "text/html").body?.textContent ?? "";
        if (normal(corpo).includes(normal(m.depois))) {
          return enviarDireto({ op: "conferida", id: m.id, conferencia: { esperado: m.depois, medido: "present in the server HTML" } });
        }
      } catch {}
      await new Promise((resolver) => setTimeout(resolver, 1500));
    }
    enviarDireto({
      op: "divergente",
      id: m.id,
      conferencia: { esperado: m.depois, medido: null, motivo: "the new text doesn't appear in the HTML the server sends" },
    });
  }

  function conferirAplicadas() {
    for (const m of vista.mudancas) {
      if (m.situacao !== "aplicada" || emConferencia.has(chaveDaConferencia(m))) continue;
      if (m.tipo === "estilo") conferirEstilo(m);
      else if (m.tipo === "texto") conferirTexto(m);
    }
  }

  return {
    carregar,
    renderizar,
    conferirAplicadas,
    get config() {
      return config;
    },
    get projeto() {
      return projeto;
    },
    get folha() {
      return folha;
    },
    vista: () => vista,
    abertas: () => vista.mudancas.filter((m) => ABERTAS.has(m.situacao)),
    abertaPorChave: (chave) => vista.mudancas.find((m) => m.chave === chave && ABERTAS.has(m.situacao)) ?? null,
    definir(mudanca) {
      enfileirar({ op: "definir", mudanca });
    },
    remover(ids) {
      enfileirar({ op: "remover", ids: [ids].flat() });
    },
    limpar() {
      const abertas = vista.mudancas.filter((m) => ABERTAS.has(m.situacao));
      if (!abertas.length) return;
      registrarPasso(abertas.map((m) => ({ chave: m.chave, anterior: m, posterior: null })));
      enfileirar({ op: "limpar" });
    },
    esquecerHistorico() {
      return enviarDireto({ op: "esquecer-historico" });
    },
    registrarPasso,
    desfazer,
    refazer,
    podeDesfazer: () => passosParaDesfazer.length > 0,
    podeRefazer: () => passosParaRefazer.length > 0,
    medirSeletor,
    esvaziar,
    async pedirAoClaude(nota) {
      await esvaziar();
      return postar({ op: "pedido", nota });
    },
  };
}
