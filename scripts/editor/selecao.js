import { criar, todos, primeiro } from "./utilitarios.js";
import { rotuloCurto, ehIgnoravel, temTextoProprio, registrarFolhaDoEditor } from "./elementos.js";
import { ehAberta } from "./loja.js";

const BLOQUEADOS = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "click",
  "dblclick",
  "auxclick",
  "contextmenu",
  "touchstart",
  "touchend",
  "dragstart",
  "submit",
];

export function criarSelecao(ctx) {
  let ativo = false;
  let sobre = null;
  let atual = null;
  let editando = null;
  let estadoDoTexto = null;
  let quadro = 0;
  let irmaosAtuais = [];

  const caixaSobre = criar("div", { classe: "caixa caixa-sobre" });
  const etiqueta = criar("span", { classe: "etiqueta", translate: "no" });
  const caixaAtual = criar(
    "div",
    { classe: "caixa caixa-atual", tabindex: "-1", role: "region", "aria-label": "Selected element" },
    criar("i", { classe: "alca alca-1" }),
    criar("i", { classe: "alca alca-2" }),
    criar("i", { classe: "alca alca-3" }),
    criar("i", { classe: "alca alca-4" }),
    etiqueta,
  );
  const irmaos = criar("div", { classe: "irmaos", "aria-hidden": "true" });
  const pinos = criar("div", { classe: "pinos" });
  const camada = criar("div", { popover: "manual", classe: "camada ferramenta oculto" }, irmaos, caixaSobre, caixaAtual, pinos);
  const folhaDoModo = new CSSStyleSheet();
  folhaDoModo.replaceSync("@layer redesign{*:not([contenteditable]){cursor:default !important}}");
  registrarFolhaDoEditor(folhaDoModo);
  ctx.raiz.append(camada);
  ctx.topo.fixar(camada);

  function deDentro(evento) {
    return evento.composedPath().includes(ctx.host);
  }

  function alvoDe(evento) {
    let alvo = evento.target;
    if (alvo && alvo.nodeType !== 1) alvo = alvo.parentElement;
    if (alvo instanceof SVGElement && alvo.localName !== "svg") alvo = alvo.closest("svg") ?? alvo;
    return ehIgnoravel(alvo) || alvo === ctx.host ? null : alvo;
  }

  function aoBloquear(evento) {
    if (!ativo || deDentro(evento)) return;
    if (editando && editando.contains(evento.target)) return;
    evento.preventDefault();
    evento.stopImmediatePropagation();
    if (editando && (evento.type === "pointerdown" || evento.type === "mousedown")) terminarTexto(true);
    if (evento.type === "click") {
      const alvo = alvoDe(evento);
      if (!alvo) return;
      ctx.raiz.activeElement?.blur();
      if (evento.altKey) {
        const base = atual && atual.contains(alvo) ? atual : alvo;
        const pai = base.parentElement;
        selecionar(pai && pai !== document.documentElement ? pai : base);
      } else selecionar(alvo);
    } else if (evento.type === "dblclick") {
      const alvo = alvoDe(evento);
      if (alvo) {
        selecionar(alvo);
        editarTexto(alvo);
      }
    }
  }

  function aoMover(evento) {
    if (!ativo || editando) return;
    const alvo = deDentro(evento) ? null : alvoDe(evento);
    if (alvo !== sobre) {
      sobre = alvo;
      ctx.emitir("sobre", sobre);
    }
  }

  function aoSairDaJanela(evento) {
    if (!evento.relatedTarget && sobre) {
      sobre = null;
      ctx.emitir("sobre", null);
    }
  }

  function ligar() {
    if (ativo) return;
    ativo = true;
    for (const tipo of BLOQUEADOS) window.addEventListener(tipo, aoBloquear, { capture: true, passive: false });
    window.addEventListener("pointermove", aoMover, { capture: true, passive: true });
    document.addEventListener("pointerout", aoSairDaJanela, true);
    camada.classList.remove("oculto");
    if (!document.adoptedStyleSheets.includes(folhaDoModo)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, folhaDoModo];
    ctx.emitir("modo", true);
    if (!quadro) quadro = requestAnimationFrame(laco);
  }

  function desligar() {
    if (!ativo) return;
    if (editando) terminarTexto(true);
    ativo = false;
    for (const tipo of BLOQUEADOS) window.removeEventListener(tipo, aoBloquear, { capture: true });
    window.removeEventListener("pointermove", aoMover, { capture: true });
    document.removeEventListener("pointerout", aoSairDaJanela, true);
    camada.classList.add("oculto");
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((folha) => folha !== folhaDoModo);
    sobre = null;
    selecionar(null);
    ctx.emitir("modo", false);
  }

  function selecionar(elemento) {
    const novo = elemento && !ehIgnoravel(elemento) && elemento !== ctx.host ? elemento : null;
    if (novo === atual) return;
    if (editando) terminarTexto(true);
    atual = novo;
    ctx.emitir("selecao", atual);
  }

  function andar(direcao) {
    if (!atual) return;
    const destinos = {
      pai: atual.parentElement !== document.documentElement ? atual.parentElement : null,
      filho: [...atual.children].find((filho) => !ehIgnoravel(filho)),
      anterior: anteriorValido(atual),
      proximo: proximoValido(atual),
    };
    if (destinos[direcao]) selecionar(destinos[direcao]);
  }

  function anteriorValido(elemento) {
    let irmao = elemento.previousElementSibling;
    while (irmao && ehIgnoravel(irmao)) irmao = irmao.previousElementSibling;
    return irmao;
  }

  function proximoValido(elemento) {
    let irmao = elemento.nextElementSibling;
    while (irmao && ehIgnoravel(irmao)) irmao = irmao.nextElementSibling;
    return irmao;
  }

  function editarTexto(elemento = atual) {
    if (!elemento) return false;
    if (!temTextoProprio(elemento)) {
      ctx.emitir("aviso", { texto: "This element has no text of its own. Click the text itself to edit it." });
      return false;
    }
    if (editando) terminarTexto(true);
    editando = elemento;
    estadoDoTexto = {
      antes: elemento.textContent,
      nos: [...elemento.childNodes],
      spellcheck: elemento.getAttribute("spellcheck"),
    };
    elemento.setAttribute("contenteditable", "plaintext-only");
    elemento.setAttribute("spellcheck", "false");
    elemento.focus({ preventScroll: true });
    const intervalo = document.createRange();
    intervalo.selectNodeContents(elemento);
    const selecaoDeTexto = getSelection();
    selecaoDeTexto.removeAllRanges();
    selecaoDeTexto.addRange(intervalo);
    elemento.addEventListener("keydown", aoTeclarNoTexto, true);
    elemento.addEventListener("blur", aoSairDoTexto);
    ctx.emitir("editandoTexto", elemento);
    return true;
  }

  function aoTeclarNoTexto(evento) {
    evento.stopPropagation();
    if (evento.key === "Escape") {
      evento.preventDefault();
      terminarTexto(false);
    } else if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault();
      terminarTexto(true);
    }
  }

  function aoSairDoTexto() {
    terminarTexto(true);
  }

  function terminarTexto(salvar) {
    const elemento = editando;
    if (!elemento) return;
    editando = null;
    elemento.removeEventListener("keydown", aoTeclarNoTexto, true);
    elemento.removeEventListener("blur", aoSairDoTexto);
    elemento.removeAttribute("contenteditable");
    if (estadoDoTexto.spellcheck === null) elemento.removeAttribute("spellcheck");
    else elemento.setAttribute("spellcheck", estadoDoTexto.spellcheck);
    const depois = elemento.textContent;
    const textoFinal = salvar ? depois : estadoDoTexto.antes;
    const originais = estadoDoTexto.nos;
    if (originais.length && originais.every((no) => no.nodeType === 3)) {
      elemento.replaceChildren(...originais);
      originais[0].data = textoFinal;
      for (const no of originais.slice(1)) no.data = "";
    } else if (!salvar) elemento.textContent = textoFinal;
    getSelection()?.removeAllRanges();
    if (salvar && depois !== estadoDoTexto.antes) ctx.edicao.texto(elemento, estadoDoTexto.antes, depois);
    estadoDoTexto = null;
    ctx.emitir("editandoTexto", null);
  }

  function colocar(caixa, retangulo) {
    if (!retangulo || (retangulo.width === 0 && retangulo.height === 0)) {
      caixa.style.display = "none";
      return;
    }
    caixa.style.display = "block";
    caixa.style.transform = `translate(${retangulo.left}px, ${retangulo.top}px)`;
    caixa.style.width = `${retangulo.width}px`;
    caixa.style.height = `${retangulo.height}px`;
  }

  function atualizarIrmaos() {
    const alvo = atual ? ctx.alvoAtual() : null;
    irmaosAtuais = alvo && alvo.alcance === "todos" ? todos(alvo.seletor).filter((e) => e !== atual).slice(0, 60) : [];
    while (irmaos.children.length < irmaosAtuais.length) irmaos.append(criar("div", { classe: "caixa caixa-irma" }));
    while (irmaos.children.length > irmaosAtuais.length) irmaos.lastElementChild.remove();
  }

  function desenharPinos() {
    const lista = ctx.loja
      .vista()
      .mudancas.filter((m) => (m.tipo === "comentario" || m.tipo === "pedido") && ehAberta(m) && m.pagina === location.pathname);
    while (pinos.children.length < lista.length) {
      const pino = criar("button", { classe: "pino", type: "button", translate: "no" });
      pino.addEventListener("click", () => ctx.emitir("abrirNota", { mudanca: pino._mudanca, ancora: pino }));
      pinos.append(pino);
    }
    while (pinos.children.length > lista.length) pinos.lastElementChild.remove();
    lista.forEach((mudanca, indice) => {
      const pino = pinos.children[indice];
      pino._mudanca = mudanca;
      const elemento = primeiro(mudanca.alvo?.seletor);
      const caixa = elemento?.getBoundingClientRect();
      if (!caixa || (caixa.width === 0 && caixa.height === 0)) {
        pino.style.display = "none";
        return;
      }
      pino.style.display = "grid";
      pino.textContent = String(indice + 1);
      pino.dataset.tipo = mudanca.tipo;
      pino.setAttribute("aria-label", `${mudanca.tipo === "pedido" ? "Request" : "Comment"} ${indice + 1}: ${mudanca.texto}`);
      pino.style.transform = `translate(${Math.max(4, caixa.right - 10)}px, ${Math.max(4, caixa.top - 10)}px)`;
    });
  }

  function laco() {
    quadro = 0;
    if (!ativo) return;
    colocar(caixaSobre, sobre && sobre !== atual && sobre.isConnected ? sobre.getBoundingClientRect() : null);
    const retangulo = atual && atual.isConnected ? atual.getBoundingClientRect() : null;
    colocar(caixaAtual, retangulo);
    if (retangulo) {
      etiqueta.textContent = `${rotuloCurto(atual)}  ${Math.round(retangulo.width)} × ${Math.round(retangulo.height)}`;
      etiqueta.classList.toggle("embaixo", retangulo.top < 24);
    }
    irmaosAtuais.forEach((elemento, indice) => colocar(irmaos.children[indice], elemento.isConnected ? elemento.getBoundingClientRect() : null));
    desenharPinos();
    ctx.emitir("quadro", retangulo);
    quadro = requestAnimationFrame(laco);
  }

  ctx.ouvir("selecao", atualizarIrmaos);
  ctx.ouvir("alcance", atualizarIrmaos);
  ctx.ouvir("mudancas", () => {
    if (atual && !atual.isConnected) selecionar(null);
  });

  return {
    ligar,
    desligar,
    alternar: () => (ativo ? desligar() : ligar()),
    selecionar,
    andar,
    editarTexto,
    terminarTexto,
    focarSelecao: () => caixaAtual.focus({ preventScroll: true }),
    destacar(elemento) {
      if (!ativo) return;
      sobre = elemento && !ehIgnoravel(elemento) ? elemento : null;
    },
    get ativo() {
      return ativo;
    },
    get atual() {
      return atual;
    },
    get sobre() {
      return sobre;
    },
    get editando() {
      return editando;
    },
  };
}
