import { criar, limitar, copiarTexto } from "./utilitarios.js";
import { icone } from "./icones.js";
import { temTextoProprio } from "./elementos.js";
import { campoMedida, campoCor, campoFonte, abrirLista, formatar } from "./campos.js";

export function criarBarra(ctx) {
  const alcanceTexto = criar("span", { classe: "alcance-texto" });
  const botaoAlcance = criar(
    "button",
    { classe: "chip-alcance", type: "button", "aria-haspopup": "listbox", "data-dica": "Where the change applies" },
    icone("alvo", 13),
    alcanceTexto,
    icone("baixo", 11),
  );
  const fonte = campoFonte({ rotulo: "Font", prop: "font-family", semRotulo: true, classe: "na-barra fonte" }, ctx);
  const tamanho = campoMedida({ rotulo: "Font size", icone: "fonte", prop: "font-size", minimo: 1, classe: "na-barra" }, ctx);
  const corDoTexto = campoCor({ rotulo: "Text color", prop: "color", semRotulo: true, soAmostra: true, classe: "na-barra redonda" }, ctx);

  function alternavel(nome, rotulo, atalho, ativoEm, aplicar) {
    const botao = criar("button", { classe: "botao-icone", type: "button", "aria-pressed": "false", "data-dica": rotulo, "aria-label": rotulo }, icone(nome, 15));
    if (atalho) botao.dataset.atalho = atalho;
    botao.addEventListener("click", () => aplicar(botao.getAttribute("aria-pressed") === "true"));
    return { elemento: botao, atualizar: (estilo) => botao.setAttribute("aria-pressed", String(ativoEm(estilo))) };
  }

  const negrito = alternavel("negrito", "Bold", null, (e) => Number(e.fontWeight) >= 600, (ligado) => ctx.edicao.estilo("font-weight", ligado ? "400" : "700"));
  const italico = alternavel("italico", "Italic", null, (e) => e.fontStyle === "italic", (ligado) => ctx.edicao.estilo("font-style", ligado ? "normal" : "italic"));
  const sublinhado = alternavel(
    "sublinhado",
    "Underline",
    null,
    (e) => e.textDecorationLine.includes("underline"),
    (ligado) => ctx.edicao.estilo("text-decoration-line", ligado ? "none" : "underline"),
  );

  const botaoLink = criar("button", { classe: "botao-icone", type: "button", "data-dica": "Make it a link", "aria-label": "Make it a link" }, icone("link", 15));
  botaoLink.addEventListener("click", () => ctx.abrirNota({ tipo: "pedido", ancora: botaoLink, rotulo: "Link address", prefixo: "Turn into a link to ", dica: "https:// or /path" }));
  const botaoLista = criar("button", { classe: "botao-icone", type: "button", "data-dica": "Make it a list", "aria-label": "Make it a list" }, icone("lista", 15));
  botaoLista.addEventListener("click", () => {
    const alvo = ctx.selecao.atual;
    if (!alvo) return;
    ctx.edicao.pedir(alvo, "Turn this text into a bulleted list, one item per line or sentence.");
    ctx.emitir("aviso", { texto: "List request noted. It goes along when you send to Claude.", tipo: "ok" });
  });

  const ALINHAMENTOS = [
    ["left", "Left", "esquerda"],
    ["center", "Center", "centro"],
    ["right", "Right", "direita"],
    ["justify", "Justify", "justificado"],
  ];
  const botaoAlinhar = criar("button", { classe: "botao-icone com-seta", type: "button", "aria-haspopup": "listbox", "data-dica": "Text align", "aria-label": "Text align" });
  let alinhamentoAtual = "left";
  botaoAlinhar.addEventListener("click", () => {
    if (ctx.topo.popAberto()?.ancora === botaoAlinhar) return ctx.topo.fecharPop(true);
    abrirLista(ctx, {
      ancora: botaoAlinhar,
      opcoes: ALINHAMENTOS.map(([valor, rotulo, nome]) => ({ valor, rotulo, amostra: icone(nome, 14) })),
      atual: alinhamentoAtual,
      rotulo: "Text align",
      largura: 180,
      aoEscolher: (valor) => ctx.edicao.estilo("text-align", valor),
    });
  });

  const fundo = campoCor({ rotulo: "Background", prop: "background-color", semRotulo: true, soAmostra: true, classe: "na-barra" }, ctx);
  const raio = campoMedida({ rotulo: "Corner radius", prop: "border-radius", icone: "raio", minimo: 0, classe: "na-barra", ler: (e) => e.borderTopLeftRadius }, ctx);
  const preenchimento = campoMedida(
    {
      rotulo: "Padding",
      prop: "padding",
      icone: "preenchimento",
      minimo: 0,
      classe: "na-barra",
      ler: (estilo) => {
        const lados = [estilo.paddingTop, estilo.paddingRight, estilo.paddingBottom, estilo.paddingLeft].map(formatar);
        return lados.every((lado) => lado === lados[0]) ? lados[0] : "Mixed";
      },
    },
    ctx,
  );

  const botaoComentario = criar("button", { classe: "botao-icone", type: "button", "data-dica": "Comment", "data-atalho": "C", "aria-label": "Comment" }, icone("comentario", 15));
  botaoComentario.addEventListener("click", () => ctx.abrirNota({ tipo: "comentario", ancora: botaoComentario }));
  const botaoMais = criar("button", { classe: "botao-icone", type: "button", "aria-haspopup": "menu", "data-dica": "More options", "aria-label": "More options" }, icone("mais", 15));
  botaoMais.addEventListener("click", () => abrirMais());

  const divisoriaDoTexto = criar("span", { classe: "divisoria" });
  const grupoTexto = criar(
    "div",
    { classe: "grupo" },
    fonte.elemento,
    tamanho.elemento,
    corDoTexto.elemento,
    criar("span", { classe: "divisoria" }),
    negrito.elemento,
    italico.elemento,
    sublinhado.elemento,
    botaoLink,
    botaoLista,
    botaoAlinhar,
  );
  const grupoCaixa = criar("div", { classe: "grupo" }, fundo.elemento, raio.elemento, preenchimento.elemento);
  const barra = criar(
    "div",
    { popover: "manual", classe: "barra ferramenta vidro oculto", role: "toolbar", "aria-label": "Edit element" },
    botaoAlcance,
    criar("span", { classe: "divisoria" }),
    grupoTexto,
    divisoriaDoTexto,
    grupoCaixa,
    criar("span", { classe: "divisoria" }),
    botaoComentario,
    botaoMais,
  );
  ctx.raiz.append(barra);
  ctx.topo.fixar(barra);

  const campos = [fonte, tamanho, corDoTexto, negrito, italico, sublinhado, fundo, raio, preenchimento];

  botaoAlcance.addEventListener("click", () => {
    if (ctx.topo.popAberto()?.ancora === botaoAlcance) return ctx.topo.fecharPop(true);
    const alvo = ctx.selecao.atual;
    if (!alvo) return;
    const todos = ctx.alvoPara(alvo, "todos");
    const este = ctx.alvoPara(alvo, "este");
    abrirLista(ctx, {
      ancora: botaoAlcance,
      rotulo: "Where the change applies",
      largura: 330,
      atual: ctx.alcance(),
      opcoes: [
        { valor: "todos", rotulo: todos.quantos > 1 ? `All ${todos.quantos} matching` : "This kind of element", detalhe: todos.seletor },
        { valor: "este", rotulo: "Only this element", detalhe: este.seletor },
      ],
      aoEscolher: (valor) => ctx.definirAlcance(valor),
    });
  });

  function abrirMais() {
    if (ctx.topo.popAberto()?.ancora === botaoMais) return ctx.topo.fecharPop(true);
    const alvo = ctx.selecao.atual;
    if (!alvo) return;
    const proprias = ctx.edicao.doElemento(alvo);
    const itens = [
      temTextoProprio(alvo) ? { valor: "texto", rotulo: "Edit text", detalhe: "Enter", amostra: icone("texto", 14) } : null,
      { valor: "pai", rotulo: "Select parent", detalhe: "↑", amostra: icone("pai", 14) },
      { valor: "painel", rotulo: ctx.painelAberto() ? "Close panel" : "Open panel", detalhe: "P", amostra: icone("painel", 14) },
      { valor: "esconder", rotulo: "Hide element", detalhe: "", amostra: icone("oculto", 14) },
      { valor: "pedido", rotulo: "Ask Claude for something else", detalhe: "", amostra: icone("enviar", 14) },
      { valor: "seletor", rotulo: "Copy selector", detalhe: "", amostra: icone("copiar", 14) },
      proprias.length
        ? { valor: "resetar", rotulo: proprias.length === 1 ? "Reset element (1 change)" : `Reset element (${proprias.length} changes)`, detalhe: "", amostra: icone("desfazer", 14) }
        : null,
    ].filter(Boolean);
    abrirLista(ctx, {
      ancora: botaoMais,
      opcoes: itens,
      rotulo: "More options",
      largura: 260,
      aoEscolher: async (valor) => {
        if (valor === "texto") ctx.selecao.editarTexto(alvo);
        else if (valor === "pai") ctx.selecao.andar("pai");
        else if (valor === "painel") ctx.alternarPainel();
        else if (valor === "esconder") ctx.edicao.estilo("display", "none");
        else if (valor === "pedido") ctx.abrirNota({ tipo: "pedido", ancora: botaoMais, rotulo: "What should Claude do here?" });
        else if (valor === "seletor") {
          const copiou = await copiarTexto(ctx.alvoAtual()?.seletor ?? "");
          ctx.emitir("aviso", copiou ? { texto: "Selector copied.", tipo: "ok" } : { texto: "Couldn't copy to the clipboard.", tipo: "erro" });
        } else if (valor === "resetar") ctx.edicao.resetarElemento(alvo);
      },
    });
  }

  let ultimaPosicao = "";
  function posicionar(retangulo) {
    if (!retangulo || barra.classList.contains("oculto")) return;
    const largura = barra.offsetWidth;
    const altura = barra.offsetHeight;
    const direitaLivre = innerWidth - (ctx.painelAberto() ? ctx.larguraDoPainel() + 24 : 0) - 8;
    let y = retangulo.top - altura - 12;
    if (y < 8) y = retangulo.bottom + 12;
    if (y + altura > innerHeight - 72) y = limitar(retangulo.top + 8, 8, innerHeight - altura - 72);
    const x = limitar(retangulo.left, 8, Math.max(8, direitaLivre - largura));
    const posicao = `${Math.round(x)},${Math.round(y)}`;
    if (posicao === ultimaPosicao) return;
    ultimaPosicao = posicao;
    barra.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    ctx.topo.reposicionarPop();
  }

  function atualizar() {
    const alvo = ctx.selecao.atual;
    const mostrar = Boolean(alvo) && ctx.selecao.ativo && !ctx.selecao.editando;
    barra.classList.toggle("oculto", !mostrar);
    if (!mostrar) return;
    const estilo = getComputedStyle(alvo);
    const comTexto = temTextoProprio(alvo) || ["input", "textarea", "button", "select"].includes(alvo.localName);
    grupoTexto.classList.toggle("oculto", !comTexto);
    divisoriaDoTexto.classList.toggle("oculto", !comTexto);
    for (const campo of campos) campo.atualizar(estilo, alvo);
    alinhamentoAtual = estilo.textAlign === "start" ? "left" : estilo.textAlign === "end" ? "right" : estilo.textAlign;
    botaoAlinhar.replaceChildren(icone(ALINHAMENTOS.find(([v]) => v === alinhamentoAtual)?.[2] ?? "esquerda", 15), icone("baixo", 10));
    const alvoAtual = ctx.alvoAtual();
    const quantos = alvoAtual?.quantos ?? 1;
    alcanceTexto.textContent = ctx.alcance() === "este" ? "Only this" : quantos > 1 ? `${quantos} matching` : "1 element";
    botaoAlcance.dataset.dica = alvoAtual?.seletor ? `Applies to ${alvoAtual.seletor}` : "Where the change applies";
    ultimaPosicao = "";
  }

  ctx.ouvir("selecao", atualizar);
  ctx.ouvir("mudancas", atualizar);
  ctx.ouvir("alcance", atualizar);
  ctx.ouvir("modo", atualizar);
  ctx.ouvir("editandoTexto", atualizar);
  ctx.ouvir("painel", () => {
    ultimaPosicao = "";
  });
  ctx.ouvir("quadro", posicionar);

  return {
    elemento: barra,
    focar: () => [...barra.querySelectorAll("button, input")].find((controle) => controle.offsetParent !== null)?.focus({ preventScroll: true }),
    botaoComentario,
  };
}
