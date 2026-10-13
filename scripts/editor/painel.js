import { criar, lerPreferencia, gravarPreferencia, limitar } from "./utilitarios.js";
import { icone } from "./icones.js";
import { ehIgnoravel, rotuloCurto, componentesDe, regrasDoElemento, temTextoProprio } from "./elementos.js";
import {
  campoMedida,
  campoCor,
  campoOpcoes,
  campoSegmentos,
  campoQuatro,
  campoFonte,
  campoTexto,
  campoAlinhamento,
  resumirSombra,
  resumirFiltro,
  resumirColunas,
} from "./campos.js";

const ehFlex = (e) => e.display === "flex" || e.display === "inline-flex";
const ehGrade = (e) => e.display === "grid" || e.display === "inline-grid";
const temPosicao = (e) => e.position !== "static";

const SECOES = [
  {
    id: "tamanho",
    titulo: "Size",
    campos: [
      { tipo: "medida", rotulo: "Width", curto: "W", prop: "width", minimo: 0, classe: "metade", modos: true },
      { tipo: "medida", rotulo: "Height", curto: "H", prop: "height", minimo: 0, classe: "metade", modos: true },
      { tipo: "medida", rotulo: "Max width", curto: "Max W", prop: "max-width", classe: "metade" },
      { tipo: "medida", rotulo: "Min height", curto: "Min H", prop: "min-height", classe: "metade" },
      {
        tipo: "opcoes",
        rotulo: "Position",
        prop: "position",
        icone: "posicao",
        opcoes: [
          ["static", "Static"],
          ["relative", "Relative"],
          ["absolute", "Absolute"],
          ["fixed", "Fixed"],
          ["sticky", "Sticky"],
        ],
      },
      { tipo: "quatro", rotulo: "Offset", icone: "posicao", atalho: "inset", props: ["top", "right", "bottom", "left"], quando: temPosicao },
      { tipo: "medida", rotulo: "Z-index", icone: "camadaZ", prop: "z-index", unidade: "", classe: "metade", quando: temPosicao },
    ],
  },
  {
    id: "layout",
    titulo: "Layout",
    campos: [
      {
        tipo: "segmentos",
        rotulo: "Display",
        prop: "display",
        opcoes: [
          ["block", "Block, stacked", "bloco"],
          ["flex", "Flex, side by side", "pilha"],
          ["grid", "Grid", "grade"],
          ["inline-block", "Inline block, flows with text", "naLinha"],
          ["none", "Hidden", "oculto"],
        ],
        equivale: (botao, valor) => botao === valor || (botao === "flex" && valor === "inline-flex") || (botao === "grid" && valor === "inline-grid"),
      },
      {
        tipo: "segmentos",
        rotulo: "Direction",
        prop: "flex-direction",
        opcoes: [
          ["row", "Horizontal", "setaDireita"],
          ["column", "Vertical", "setaBaixo"],
          ["row-reverse", "Horizontal, reversed", "setaEsquerda"],
          ["column-reverse", "Vertical, reversed", "setaCima"],
        ],
        quando: ehFlex,
      },
      { tipo: "alinhamento", rotulo: "Align", quando: ehFlex },
      { tipo: "medida", rotulo: "Gap", icone: "espaco", prop: "gap", minimo: 0, classe: "metade", quando: (e) => ehFlex(e) || ehGrade(e), ler: (e) => e.rowGap },
      {
        tipo: "segmentos",
        rotulo: "Wrap",
        prop: "flex-wrap",
        classe: "metade sem-rotulo",
        semRotulo: true,
        opcoes: [
          ["nowrap", "Keep on one line", null, "No wrap"],
          ["wrap", "Wrap onto new lines", null, "Wrap"],
        ],
        quando: ehFlex,
      },
      {
        tipo: "texto",
        rotulo: "Columns",
        prop: "grid-template-columns",
        icone: "grade",
        quando: ehGrade,
        resumir: resumirColunas,
        presets: [
          ["repeat(2, minmax(0, 1fr))", "2 equal columns"],
          ["repeat(3, minmax(0, 1fr))", "3 equal columns"],
          ["repeat(4, minmax(0, 1fr))", "4 equal columns"],
          ["repeat(auto-fill, minmax(240px, 1fr))", "Auto-fill, 240px minimum"],
        ],
      },
      { tipo: "quatro", rotulo: "Padding", icone: "preenchimento", atalho: "padding", props: ["padding-top", "padding-right", "padding-bottom", "padding-left"], minimo: 0 },
      { tipo: "quatro", rotulo: "Margin", icone: "margem", atalho: "margin", props: ["margin-top", "margin-right", "margin-bottom", "margin-left"] },
    ],
  },
  {
    id: "texto",
    titulo: "Text",
    campos: [
      { tipo: "fonte", rotulo: "Font", prop: "font-family", semRotulo: true },
      {
        tipo: "opcoes",
        rotulo: "Weight",
        prop: "font-weight",
        amostraEstilo: "fontWeight",
        semRotulo: true,
        classe: "metade",
        opcoes: [
          ["100", "Thin"],
          ["200", "Extra light"],
          ["300", "Light"],
          ["400", "Regular"],
          ["500", "Medium"],
          ["600", "Semibold"],
          ["700", "Bold"],
          ["800", "Extra bold"],
          ["900", "Black"],
        ],
      },
      { tipo: "medida", rotulo: "Font size", icone: "fonte", prop: "font-size", minimo: 1, classe: "metade" },
      { tipo: "medida", rotulo: "Line height", icone: "linha", prop: "line-height", unidade: "", passo: 0.05, base: "1.2", mostrarUnidade: true, classe: "metade" },
      { tipo: "medida", rotulo: "Letter spacing", icone: "letras", prop: "letter-spacing", unidade: "px", passo: 0.1, base: "0px", classe: "metade" },
      { tipo: "cor", rotulo: "Text color", curto: "Color", prop: "color" },
      {
        tipo: "segmentos",
        rotulo: "Align",
        prop: "text-align",
        opcoes: [
          ["left", "Left", "esquerda"],
          ["center", "Center", "centro"],
          ["right", "Right", "direita"],
          ["justify", "Justify", "justificado"],
        ],
        equivale: (botao, valor) => botao === valor || (botao === "left" && valor === "start") || (botao === "right" && valor === "end"),
      },
      {
        tipo: "segmentos",
        rotulo: "Case",
        prop: "text-transform",
        opcoes: [
          ["none", "As typed", null, "Aa"],
          ["uppercase", "UPPERCASE", null, "AA"],
          ["lowercase", "lowercase", null, "aa"],
          ["capitalize", "Capitalize Each Word", null, "Ab"],
        ],
      },
    ],
  },
  {
    id: "aparencia",
    titulo: "Appearance",
    campos: [
      { tipo: "cor", rotulo: "Background", prop: "background-color" },
      { tipo: "medida", rotulo: "Opacity", icone: "opacidade", prop: "opacity", porcentagem: true, minimo: 0, maximo: 1, classe: "metade" },
      { tipo: "medida", rotulo: "Corner radius", icone: "raio", prop: "border-radius", minimo: 0, classe: "metade", ler: (e) => e.borderTopLeftRadius },
      { tipo: "medida", rotulo: "Border width", icone: "borda", prop: "border-width", minimo: 0, classe: "metade", ler: (e) => e.borderTopWidth },
      {
        tipo: "opcoes",
        rotulo: "Border style",
        prop: "border-style",
        semRotulo: true,
        classe: "metade",
        ler: (e) => e.borderTopStyle,
        opcoes: [
          ["none", "No border"],
          ["solid", "Solid"],
          ["dashed", "Dashed"],
          ["dotted", "Dotted"],
        ],
      },
      { tipo: "cor", rotulo: "Border color", curto: "Border", prop: "border-color", ler: (e) => e.borderTopColor },
    ],
  },
  {
    id: "efeitos",
    titulo: "Effects",
    campos: [
      {
        tipo: "texto",
        rotulo: "Shadow",
        prop: "box-shadow",
        icone: "sombra",
        resumir: resumirSombra,
        presets: [
          ["none", "No shadow"],
          ["0 1px 2px rgb(0 0 0 / 0.08)", "Subtle"],
          ["0 4px 12px rgb(0 0 0 / 0.12)", "Medium"],
          ["0 12px 32px rgb(0 0 0 / 0.18)", "Strong"],
          ["0 24px 64px rgb(0 0 0 / 0.24)", "Floating"],
        ],
      },
      { tipo: "medida", rotulo: "Rotation", icone: "rotacao", prop: "rotate", unidade: "deg", base: "0deg", mostrarUnidade: true, vazio: "0°", classe: "metade" },
      { tipo: "medida", rotulo: "Scale", icone: "escala", prop: "scale", porcentagem: true, minimo: 0, maximo: 10, vazio: "100%", classe: "metade" },
      {
        tipo: "texto",
        rotulo: "Glass",
        prop: "backdrop-filter",
        icone: "opacidade",
        resumir: resumirFiltro,
        presets: [
          ["none", "No blur"],
          ["blur(8px)", "Light"],
          ["blur(16px) saturate(1.4)", "Glass"],
          ["blur(32px) saturate(1.6)", "Strong glass"],
        ],
      },
      {
        tipo: "texto",
        rotulo: "Filter",
        prop: "filter",
        icone: "ajustar",
        resumir: resumirFiltro,
        presets: [
          ["none", "No filter"],
          ["grayscale(1)", "Black and white"],
          ["brightness(1.1)", "Brighter"],
          ["brightness(0.9)", "Darker"],
          ["blur(4px)", "Blurred"],
        ],
      },
    ],
  },
];

const FABRICAS = {
  medida: campoMedida,
  cor: campoCor,
  opcoes: campoOpcoes,
  segmentos: campoSegmentos,
  quatro: campoQuatro,
  fonte: campoFonte,
  texto: campoTexto,
  alinhamento: campoAlinhamento,
};

const LARGURA_PADRAO = 360;
const LARGURA_MINIMA = 300;
const larguraMaxima = () => Math.max(LARGURA_MINIMA, Math.min(640, innerWidth - 360));

export function iconeDoElemento(elemento) {
  const tag = elemento.localName;
  if (tag === "img" || tag === "picture" || tag === "video" || tag === "canvas") return "imagem";
  if (tag === "svg") return "vetor";
  if (tag === "button" || elemento.getAttribute?.("role") === "button") return "botao";
  if (tag === "a") return "link";
  if (tag === "input" || tag === "textarea" || tag === "select") return "campoDeTexto";
  if (tag === "ul" || tag === "ol") return "lista";
  if (["section", "header", "footer", "main", "nav", "aside", "article"].includes(tag)) return "secao";
  if (temTextoProprio(elemento) && elemento.children.length === 0) return "letra";
  return "quadro";
}

export function criarPainel(ctx) {
  let aberto = lerPreferencia("painelAberto", true);
  const fechadas = new Set(lerPreferencia("secoesFechadas", ["efeitos", "regras"]));
  const expandidos = new WeakSet();

  const iconeDoTopo = criar("span", { classe: "painel-icone" });
  const nome = criar("strong", { classe: "painel-nome", translate: "no" });
  const detalhe = criar("code", { classe: "painel-detalhe", translate: "no" });
  const botaoFechar = criar("button", { classe: "botao-icone", type: "button", "data-dica": "Close panel", "data-atalho": "P", "aria-label": "Close panel" }, icone("fechar", 14));
  const pilulaDoAlcance = criar("span", { classe: "seg-pilula", "aria-hidden": "true" });
  const opcaoTodos = criar("button", { classe: "seg-opcao", type: "button", role: "radio", "aria-checked": "true" });
  const opcaoEste = criar("button", { classe: "seg-opcao", type: "button", role: "radio", "aria-checked": "false", texto: "Only this" });
  const alcance = criar("div", { classe: "seg alcance", role: "radiogroup", "aria-label": "Where the change applies" }, pilulaDoAlcance, opcaoTodos, opcaoEste);
  const seletorDoAlcance = criar("code", { classe: "alcance-seletor", translate: "no" });
  opcaoTodos.addEventListener("click", () => ctx.definirAlcance("todos"));
  opcaoEste.addEventListener("click", () => ctx.definirAlcance("este"));

  const topo = criar(
    "header",
    { classe: "painel-topo" },
    criar("div", { classe: "painel-identidade" }, iconeDoTopo, criar("div", { classe: "painel-titulo" }, nome, detalhe), botaoFechar),
    criar("div", { classe: "painel-alcance" }, alcance, seletorDoAlcance),
  );
  const vazio = criar(
    "div",
    { classe: "painel-vazio" },
    criar("div", { classe: "vazio-icone" }, icone("cursor", 18)),
    criar("p", { classe: "vazio-titulo", texto: "Select an element" }),
    criar("p", { classe: "vazio-texto", texto: "Click anything on the page to adjust its size, text, color and spacing." }),
    criar(
      "ul",
      { classe: "atalhos" },
      [
        ["E", "toggle editing"],
        ["Click", "select"],
        ["Double-click", "edit text"],
        ["↑  or  Alt+click", "select parent"],
        ["↓  ←  →", "child and siblings"],
        ["C", "comment"],
        ["P", "toggle panel"],
        ["Ctrl+Z", "undo"],
        ["Esc", "deselect"],
      ].map(([tecla, efeito]) => criar("li", {}, criar("kbd", { texto: tecla }), criar("span", { texto: efeito }))),
    ),
  );

  const arvore = criar("div", { classe: "arvore", role: "tree", "aria-label": "Page layers" });
  const listaDeRegras = criar("div", { classe: "regras" });
  const camposDoPainel = [];

  function secao(id, titulo, conteudo) {
    const corpo = criar("div", { classe: "secao-corpo" }, conteudo);
    const cabeca = criar(
      "button",
      { classe: "secao-cabeca", type: "button", "aria-expanded": String(!fechadas.has(id)) },
      criar("span", { classe: "secao-titulo", texto: titulo }),
      criar("span", { classe: "secao-seta" }, icone("baixo", 12)),
    );
    const elemento = criar("section", { classe: `secao ${fechadas.has(id) ? "fechada" : ""}`, dados: { secao: id } }, cabeca, corpo);
    cabeca.addEventListener("click", () => {
      const fechar = !elemento.classList.contains("fechada");
      elemento.classList.toggle("fechada", fechar);
      cabeca.setAttribute("aria-expanded", String(!fechar));
      if (fechar) fechadas.add(id);
      else fechadas.delete(id);
      gravarPreferencia("secoesFechadas", [...fechadas]);
      if (!fechar) atualizar();
      if (id === "camadas" && !fechar) desenharArvore();
      if (id === "regras" && !fechar) desenharRegras();
    });
    return elemento;
  }

  const secoes = [secao("camadas", "Layers", arvore)];
  for (const definicao of SECOES) {
    const campos = definicao.campos.map((def) => {
      const campo = FABRICAS[def.tipo](def, ctx);
      camposDoPainel.push({ def, campo, secao: definicao.id });
      return campo.elemento;
    });
    secoes.push(secao(definicao.id, definicao.titulo, criar("div", { classe: "grade-campos" }, campos)));
  }
  secoes.push(secao("regras", "CSS rules", listaDeRegras));

  const alca = criar("div", {
    classe: "painel-alca",
    role: "separator",
    tabindex: "0",
    "aria-orientation": "vertical",
    "aria-label": "Panel width. Drag, or use the arrow keys; Enter resets it.",
    "aria-valuemin": String(LARGURA_MINIMA),
  });
  const rolagem = criar("div", { classe: "painel-rolagem" }, secoes);
  const painel = criar("aside", { popover: "manual", classe: "painel ferramenta oculto", "aria-label": "Element properties" }, alca, topo, vazio, rolagem);
  ctx.raiz.append(painel);
  ctx.topo.fixar(painel);

  let largura = LARGURA_PADRAO;
  let arrasto = null;
  let redesenho = 0;

  function definirLargura(nova) {
    largura = Math.round(limitar(Number(nova) || LARGURA_PADRAO, LARGURA_MINIMA, larguraMaxima()));
    painel.style.setProperty("--largura-do-painel", `${largura}px`);
    alca.setAttribute("aria-valuenow", String(largura));
    alca.setAttribute("aria-valuemax", String(larguraMaxima()));
  }

  function redimensionar(nova, gravar) {
    definirLargura(nova);
    if (gravar) gravarPreferencia("larguraDoPainel", largura);
    if (redesenho) return;
    redesenho = requestAnimationFrame(() => {
      redesenho = 0;
      atualizar();
      ctx.emitir("painel", aberto);
    });
  }

  definirLargura(lerPreferencia("larguraDoPainel", LARGURA_PADRAO));

  alca.addEventListener("pointerdown", (evento) => {
    if (evento.button !== 0) return;
    evento.preventDefault();
    alca.setPointerCapture(evento.pointerId);
    arrasto = { inicio: evento.clientX, larguraInicial: largura };
    alca.classList.add("arrastando");
    painel.classList.add("redimensionando");
  });
  alca.addEventListener("pointermove", (evento) => {
    if (arrasto) redimensionar(arrasto.larguraInicial + arrasto.inicio - evento.clientX, false);
  });
  const soltar = () => {
    if (!arrasto) return;
    arrasto = null;
    alca.classList.remove("arrastando");
    painel.classList.remove("redimensionando");
    gravarPreferencia("larguraDoPainel", largura);
  };
  alca.addEventListener("pointerup", soltar);
  alca.addEventListener("pointercancel", soltar);
  alca.addEventListener("dblclick", () => redimensionar(LARGURA_PADRAO, true));
  alca.addEventListener("keydown", (evento) => {
    const passo = evento.shiftKey ? 60 : 20;
    const destinos = { ArrowLeft: largura + passo, ArrowRight: largura - passo, Home: LARGURA_MINIMA, End: larguraMaxima(), Enter: LARGURA_PADRAO };
    if (!(evento.key in destinos)) return;
    evento.preventDefault();
    redimensionar(destinos[evento.key], true);
  });
  addEventListener("resize", () => redimensionar(lerPreferencia("larguraDoPainel", LARGURA_PADRAO), false));

  botaoFechar.addEventListener("click", () => alternar(false));

  function marcarAlcance() {
    const atual = ctx.alcance();
    const alvo = ctx.alvoAtual();
    const todos = alvo && atual === "todos" ? alvo.quantos : ctx.selecao.atual ? ctx.alvoPara(ctx.selecao.atual, "todos").quantos : 1;
    opcaoTodos.textContent = todos > 1 ? `All ${todos} matching` : "This kind";
    opcaoTodos.dataset.dica = todos > 1 ? `The change applies to all ${todos} elements like this one` : "The change applies to this kind of element";
    opcaoEste.dataset.dica = "The change applies to this element only";
    opcaoTodos.setAttribute("aria-checked", String(atual === "todos"));
    opcaoEste.setAttribute("aria-checked", String(atual === "este"));
    const ativo = atual === "este" ? opcaoEste : opcaoTodos;
    requestAnimationFrame(() => {
      pilulaDoAlcance.style.opacity = "1";
      pilulaDoAlcance.style.width = `${ativo.offsetWidth}px`;
      pilulaDoAlcance.style.transform = `translateX(${ativo.offsetLeft}px)`;
    });
    seletorDoAlcance.textContent = alvo?.seletor ?? "";
    seletorDoAlcance.dataset.dica = alvo?.seletor ?? "";
    seletorDoAlcance.classList.toggle("oculto", !alvo?.seletor || alvo.seletor === detalhe.textContent);
  }

  function desenharArvore() {
    if (fechadas.has("camadas") || !aberto || !ctx.selecao.ativo) return;
    const atual = ctx.selecao.atual;
    const caminho = new Set();
    for (let a = atual; a; a = a.parentElement) caminho.add(a);
    const linhas = [];
    const visitar = (elemento, nivel, componenteDoPai) => {
      if (linhas.length > 600 || ehIgnoravel(elemento) || elemento === ctx.host) return;
      const filhos = [...elemento.children].filter((filho) => !ehIgnoravel(filho) && filho !== ctx.host);
      const expandido = caminho.has(elemento) || expandidos.has(elemento);
      const componente = componentesDe(elemento, 1)[0] ?? null;
      linhas.push({ elemento, nivel, temFilhos: filhos.length > 0, expandido, componente: componente !== componenteDoPai ? componente : null });
      if (expandido) for (const filho of filhos.slice(0, 200)) visitar(filho, nivel + 1, componente);
    };
    visitar(document.body, 0, null);
    arvore.replaceChildren(
      ...linhas.map(({ elemento, nivel, temFilhos, expandido, componente }) => {
        const seta = criar(
          "span",
          { classe: `seta ${temFilhos ? "" : "invisivel"} ${expandido ? "aberta" : ""}`, "aria-hidden": "true" },
          icone("lado", 11),
        );
        const guias = Array.from({ length: Math.min(nivel, 16) }, () => criar("span", { classe: "guia" }));
        const linha = criar(
          "div",
          {
            classe: `camada-linha ${elemento === atual ? "atual" : ""}`,
            role: "treeitem",
            tabindex: elemento === atual ? "0" : "-1",
            "aria-selected": String(elemento === atual),
            "aria-expanded": temFilhos ? String(expandido) : null,
            "aria-level": String(nivel + 1),
          },
          guias,
          seta,
          criar("span", { classe: "camada-tipo" }, icone(iconeDoElemento(elemento), 13)),
          criar("span", { classe: "camada-nome", translate: "no", texto: rotuloCurto(elemento) }),
          componente ? criar("span", { classe: "camada-componente", translate: "no", texto: componente }) : null,
        );
        seta.addEventListener("click", (evento) => {
          evento.stopPropagation();
          if (expandidos.has(elemento)) expandidos.delete(elemento);
          else expandidos.add(elemento);
          desenharArvore();
        });
        linha.addEventListener("click", () => ctx.selecao.selecionar(elemento));
        linha.addEventListener("pointerenter", () => ctx.destacar(elemento));
        linha.addEventListener("pointerleave", () => ctx.destacar(null));
        return linha;
      }),
    );
    arvore.querySelector(".camada-linha.atual")?.scrollIntoView({ block: "nearest" });
  }

  function desenharRegras() {
    if (fechadas.has("regras") || !aberto) return;
    const alvo = ctx.selecao.atual;
    if (!alvo) return listaDeRegras.replaceChildren();
    const regras = regrasDoElemento(alvo).reverse().slice(0, 40);
    listaDeRegras.replaceChildren(
      ...regras.map((regra) =>
        criar(
          "details",
          { classe: "regra", translate: "no" },
          criar(
            "summary",
            {},
            criar("code", { classe: "regra-seletor", texto: regra.seletor }),
            criar("span", { classe: "regra-origem", texto: regra.origem + (regra.media ? `  ·  @media ${regra.media}` : "") }),
          ),
          criar("pre", { texto: regra.declaracoes.replace(/;\s*/g, ";\n").trim() }),
        ),
      ),
    );
    if (!regras.length) listaDeRegras.append(criar("p", { classe: "vazio", texto: "No stylesheet rule matches this element." }));
  }

  function atualizar() {
    const alvo = ctx.selecao.atual;
    painel.classList.toggle("oculto", !(aberto && ctx.selecao.ativo));
    if (!aberto || !ctx.selecao.ativo) return;
    vazio.classList.toggle("oculto", Boolean(alvo));
    rolagem.classList.toggle("oculto", !alvo);
    topo.classList.toggle("oculto", !alvo);
    if (!alvo) return;
    const componentes = componentesDe(alvo, 2);
    iconeDoTopo.replaceChildren(icone(iconeDoElemento(alvo), 16));
    nome.textContent = componentes[0] ?? rotuloCurto(alvo);
    detalhe.textContent = rotuloCurto(alvo);
    marcarAlcance();
    const estilo = getComputedStyle(alvo);
    for (const { def, campo, secao: id } of camposDoPainel) {
      const visivel = def.quando ? def.quando(estilo) : true;
      campo.elemento.classList.toggle("oculto", !visivel);
      if (visivel && !fechadas.has(id)) campo.atualizar(estilo, alvo);
    }
  }

  function alternar(forcar) {
    aberto = typeof forcar === "boolean" ? forcar : !aberto;
    gravarPreferencia("painelAberto", aberto);
    atualizar();
    desenharArvore();
    desenharRegras();
    ctx.emitir("painel", aberto);
  }

  let releitura = 0;
  const reler = (evento) => {
    if (evento.target !== ctx.selecao.atual || releitura) return;
    releitura = requestAnimationFrame(() => {
      releitura = 0;
      atualizar();
    });
  };
  document.addEventListener("transitionend", reler, true);
  document.addEventListener("animationend", reler, true);

  ctx.ouvir("selecao", () => {
    atualizar();
    desenharArvore();
    desenharRegras();
  });
  ctx.ouvir("mudancas", atualizar);
  ctx.ouvir("alcance", atualizar);
  ctx.ouvir("modo", () => {
    atualizar();
    desenharArvore();
  });

  return {
    alternar,
    get aberto() {
      return aberto && ctx.selecao.ativo;
    },
    largura: () => largura,
  };
}
