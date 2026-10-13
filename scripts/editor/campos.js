import { criar, limitar } from "./utilitarios.js";
import { icone } from "./icones.js";
import { rgbaDe, hexDe, hexDeOklch, oklchDeRgb, hexDeRgba } from "./cor.js";

const recentes = [];
const PALAVRAS = { auto: "Auto", none: "None", normal: "Normal", "fit-content": "Hug", "max-content": "Hug", "min-content": "Min" };

function arredondar(numero, casas = 2) {
  const fator = 10 ** casas;
  return Math.round(numero * fator) / fator;
}

function partes(valor) {
  const achado = /^(-?\d*\.?\d+(?:e-?\d+)?)([a-z%]*)$/i.exec(String(valor ?? "").trim());
  return achado ? { numero: parseFloat(achado[1]), unidade: achado[2] } : null;
}

export function formatar(valor) {
  const p = partes(valor);
  return p ? `${arredondar(p.numero)}${p.unidade}` : String(valor ?? "").trim();
}

function paraMostrar(valor, def) {
  const bruto = String(valor ?? "").trim();
  if (def.vazio && (bruto === "none" || bruto === "")) return def.vazio;
  if (def.porcentagem) {
    const p = partes(bruto);
    return p ? `${Math.round(p.numero * 100)}%` : bruto;
  }
  const p = partes(bruto);
  if (p) {
    if (p.unidade === "px" && !def.mostrarUnidade) return String(arredondar(p.numero, 1));
    if (p.unidade === "deg") return `${arredondar(p.numero, 1)}°`;
    return `${arredondar(p.numero, p.unidade === "" ? 2 : 1)}${p.unidade}`;
  }
  return PALAVRAS[bruto] ?? bruto;
}

function normalizar(texto, def) {
  const limpo = String(texto ?? "").trim().replace(",", ".").replace(/°$/, "");
  if (!limpo) return null;
  const chave = Object.entries(PALAVRAS).find(([, rotulo]) => rotulo.toLowerCase() === limpo.toLowerCase());
  if (chave) return chave[0];
  if (def.porcentagem) {
    const p = partes(limpo.replace("%", ""));
    return p ? String(limitar(arredondar(p.numero / 100, 3), def.minimo ?? 0, def.maximo ?? 1)) : null;
  }
  if (/^-?\d*\.?\d+$/.test(limpo)) {
    let numero = parseFloat(limpo);
    if (def.minimo !== undefined) numero = Math.max(def.minimo, numero);
    if (def.maximo !== undefined) numero = Math.min(def.maximo, numero);
    const unidade = def.unidade ?? "px";
    return `${numero}${unidade}`;
  }
  return limpo;
}

function somar(valor, delta, def) {
  if (def.porcentagem) {
    const p = partes(valor) ?? { numero: 1 };
    return String(limitar(arredondar(p.numero + delta / 100, 3), def.minimo ?? 0, def.maximo ?? 1));
  }
  const p = partes(valor) ?? partes(def.base) ?? { numero: 0, unidade: def.unidade ?? "px" };
  let numero = arredondar(p.numero + delta);
  if (def.minimo !== undefined) numero = Math.max(def.minimo, numero);
  if (def.maximo !== undefined) numero = Math.min(def.maximo, numero);
  return `${numero}${p.unidade || def.unidade || ""}`;
}

function focado(ctx, elemento) {
  return ctx.raiz.activeElement === elemento;
}

function arrastavel(alca, aoMudar) {
  let inicio = null;
  let acumulado = 0;
  alca.addEventListener("pointerdown", (evento) => {
    if (evento.button !== 0) return;
    evento.preventDefault();
    alca.setPointerCapture(evento.pointerId);
    inicio = evento.clientX;
    acumulado = 0;
    alca.classList.add("arrastando");
  });
  alca.addEventListener("pointermove", (evento) => {
    if (inicio === null) return;
    const passos = Math.trunc((evento.clientX - inicio) / 3);
    if (passos !== acumulado) {
      const delta = passos - acumulado;
      acumulado = passos;
      aoMudar(delta * (evento.shiftKey ? 10 : 1));
    }
  });
  const soltar = () => {
    inicio = null;
    alca.classList.remove("arrastando");
  };
  alca.addEventListener("pointerup", soltar);
  alca.addEventListener("pointercancel", soltar);
}

export function abrirLista(ctx, { ancora, opcoes, atual, aoEscolher, busca = false, livre = false, rotulo = "Options", largura }) {
  let filtradas = opcoes;
  let indice = Math.max(0, opcoes.findIndex((opcao) => opcao.valor === atual));
  const lista = criar("div", { classe: "lista", role: "listbox", "aria-label": rotulo });
  const entrada = busca
    ? criar("input", { classe: "entrada busca", type: "text", spellcheck: "false", placeholder: livre ? "Search or type a name" : "Search", "data-foco": "", "aria-label": `Search ${rotulo.toLowerCase()}` })
    : null;

  function escolher(valor) {
    ctx.topo.fecharPop(true);
    aoEscolher(valor);
  }

  function marcar() {
    [...lista.children].forEach((filho, i) => filho.classList.toggle("realce", i === indice));
    lista.children[indice]?.scrollIntoView({ block: "nearest" });
  }

  function desenhar() {
    lista.replaceChildren(
      ...filtradas.map((opcao, i) =>
        criar(
          "div",
          {
            role: "option",
            classe: `opcao ${i === indice ? "realce" : ""}`,
            tabindex: "-1",
            "aria-selected": String(opcao.valor === atual),
            on: {
              click: () => escolher(opcao.valor),
              pointermove: () => {
                if (indice !== i) {
                  indice = i;
                  marcar();
                }
              },
            },
          },
          criar("span", { classe: "opcao-marca" }, opcao.valor === atual ? icone("marca", 13) : null),
          opcao.amostra ?? null,
          criar("span", { classe: "opcao-rotulo", translate: opcao.dado ? "no" : undefined, texto: opcao.rotulo, estilo: opcao.estilo }),
          opcao.detalhe ? criar("span", { classe: "opcao-detalhe", texto: opcao.detalhe }) : null,
        ),
      ),
    );
    if (!filtradas.length && livre && entrada?.value.trim()) {
      lista.append(criar("div", { classe: "opcao vazia realce", role: "option", texto: `Use "${entrada.value.trim()}"`, on: { click: () => escolher(entrada.value.trim()) } }));
    }
  }

  const raiz = criar("div", { classe: "caixa-lista", estilo: largura ? { width: `${largura}px` } : {} }, entrada, lista);
  raiz.addEventListener("keydown", (evento) => {
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      if (!filtradas.length) return;
      indice = limitar(indice + (evento.key === "ArrowDown" ? 1 : -1), 0, filtradas.length - 1);
      marcar();
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      if (filtradas[indice]) escolher(filtradas[indice].valor);
      else if (livre && entrada?.value.trim()) escolher(entrada.value.trim());
    } else if ((evento.key === "Home" || evento.key === "End") && evento.target !== entrada) {
      evento.preventDefault();
      indice = evento.key === "Home" ? 0 : filtradas.length - 1;
      marcar();
    }
  });
  entrada?.addEventListener("input", () => {
    const termo = entrada.value.trim().toLowerCase();
    filtradas = termo ? opcoes.filter((opcao) => `${opcao.rotulo} ${opcao.detalhe ?? ""}`.toLowerCase().includes(termo)) : opcoes;
    indice = 0;
    desenhar();
  });
  desenhar();
  ctx.topo.abrirPop(raiz, ancora, { papel: "presentation", rotulo, classe: "pop-menu" });
  if (!entrada) (lista.children[indice] ?? lista).focus({ preventScroll: true });
  marcar();
}

function prefixo(def) {
  if (def.icone) return criar("span", { classe: "prefixo", "data-dica": `${def.rotulo}. Drag to adjust.` }, icone(def.icone, 13));
  return criar("span", { classe: "prefixo texto", "data-dica": `${def.rotulo}. Drag to adjust.`, texto: def.curto ?? def.rotulo.slice(0, 1) });
}

const MODOS_DE_TAMANHO = [
  ["fixa", "Fixed", "fixa"],
  ["fit-content", "Hug contents", "abracar"],
  ["100%", "Fill container", "preencher"],
  ["auto", "Auto", "fixa"],
];

function modoDe(declarado) {
  const valor = String(declarado ?? "").trim();
  if (/fit-content|max-content|min-content/.test(valor)) return "fit-content";
  if (valor === "100%" || valor === "stretch" || valor === "-webkit-fill-available") return "100%";
  if (valor === "auto" || valor === "") return "auto";
  return "fixa";
}

export function campoMedida(def, ctx) {
  const entrada = criar("input", { classe: "num", type: "text", spellcheck: "false", inputmode: "decimal", "aria-label": def.rotulo, autocomplete: "off" });
  const inicio = prefixo(def);
  const botaoModo = def.modos
    ? criar("button", { classe: "modo", type: "button", "aria-haspopup": "listbox", "aria-label": `${def.rotulo} sizing` }, icone("fixa", 12))
    : null;
  const elemento = criar("label", { classe: `campo-num ${def.classe ?? ""}`, "data-campo": def.prop ?? "" }, inicio, entrada, botaoModo);
  let valorAtual = "";

  const textoEmEdicao = () => paraMostrar(valorAtual, { ...def, mostrarUnidade: true });

  function mostrar() {
    entrada.value = focado(ctx, entrada) ? textoEmEdicao() : paraMostrar(valorAtual, def);
  }

  function aplicar(valor) {
    if (valor === null || valor === valorAtual) {
      mostrar();
      return;
    }
    valorAtual = valor;
    mostrar();
    def.aoMudar ? def.aoMudar(valor) : ctx.edicao.estilo(def.prop, valor);
  }

  function confirmar(texto) {
    if (String(texto ?? "").trim() === textoEmEdicao()) return mostrar();
    aplicar(normalizar(texto, def));
  }

  arrastavel(inicio, (delta) => aplicar(somar(valorAtual, delta * (def.passo ?? 1), def)));
  entrada.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter") {
      evento.preventDefault();
      confirmar(entrada.value);
      entrada.select();
    } else if (evento.key === "ArrowUp" || evento.key === "ArrowDown") {
      evento.preventDefault();
      const multiplo = evento.shiftKey ? 10 : evento.altKey ? 0.1 : 1;
      const sinal = evento.key === "ArrowUp" ? 1 : -1;
      aplicar(somar(valorAtual, sinal * multiplo * (def.passo ?? 1), def));
      entrada.select();
    } else if (evento.key === "Escape" && entrada.dataset.sujo === "1") {
      mostrar();
    }
  });
  entrada.addEventListener("change", () => confirmar(entrada.value));
  entrada.addEventListener("focus", () => {
    mostrar();
    entrada.select();
  });
  entrada.addEventListener("blur", mostrar);

  botaoModo?.addEventListener("click", (evento) => {
    evento.preventDefault();
    if (ctx.topo.popAberto()?.ancora === botaoModo) return ctx.topo.fecharPop(true);
    const atual = modoDe(ctx.declarado(def.prop));
    abrirLista(ctx, {
      ancora: botaoModo,
      rotulo: def.rotulo,
      atual,
      largura: 210,
      opcoes: MODOS_DE_TAMANHO.map(([valor, rotulo, nome]) => ({ valor, rotulo, amostra: icone(nome, 13), detalhe: valor === "fixa" ? paraMostrar(valorAtual, def) : "" })),
      aoEscolher: (valor) => {
        if (valor === "fixa") return entrada.focus();
        ctx.edicao.estilo(def.prop, valor);
      },
    });
  });

  return {
    elemento,
    atualizar(estilo) {
      valorAtual = formatar(def.ler ? def.ler(estilo) : estilo.getPropertyValue(def.prop));
      if (!focado(ctx, entrada) || entrada.dataset.sujo !== "1") mostrar();
      if (botaoModo) {
        const modo = modoDe(ctx.declarado(def.prop));
        const achado = MODOS_DE_TAMANHO.find(([valor]) => valor === modo);
        botaoModo.replaceChildren(icone(achado?.[2] ?? "fixa", 12));
        botaoModo.dataset.dica = `${def.rotulo}: ${achado?.[1] ?? "Fixed"}`;
      }
    },
  };
}

export function campoOpcoes(def, ctx) {
  const textoDoBotao = criar("span", { classe: "botao-lista-texto" });
  const botao = criar(
    "button",
    { classe: "botao-lista", type: "button", "aria-haspopup": "listbox", "aria-label": def.rotulo, "data-dica": def.dica ?? def.rotulo },
    def.icone ? criar("span", { classe: "prefixo" }, icone(def.icone, 13)) : null,
    textoDoBotao,
    criar("span", { classe: "seta-lista" }, icone("baixo", 12)),
  );
  const elemento = criar(
    "div",
    { classe: `campo ${def.classe ?? ""}`, "data-campo": def.prop ?? "" },
    def.semRotulo ? null : criar("span", { classe: "rotulo", texto: def.curto ?? def.rotulo }),
    botao,
  );
  let valorAtual = "";

  botao.addEventListener("click", () => {
    if (ctx.topo.popAberto()?.ancora === botao) return ctx.topo.fecharPop(true);
    abrirLista(ctx, {
      ancora: botao,
      opcoes: def.opcoes.map(([valor, rotulo]) => ({ valor, rotulo, estilo: def.amostraEstilo ? { [def.amostraEstilo]: valor } : undefined })),
      atual: valorAtual,
      rotulo: def.rotulo,
      largura: Math.max(botao.offsetWidth, 180),
      aoEscolher: (valor) => {
        valorAtual = valor;
        mostrar(valor);
        def.aoMudar ? def.aoMudar(valor) : ctx.edicao.estilo(def.prop, valor);
      },
    });
  });

  function mostrar(valor) {
    const achada = def.opcoes.find(([item]) => String(item) === String(valor));
    textoDoBotao.textContent = achada ? achada[1] : paraMostrar(valor, def) || "—";
  }

  return {
    elemento,
    atualizar(estilo) {
      valorAtual = (def.ler ? def.ler(estilo) : estilo.getPropertyValue(def.prop)).trim();
      mostrar(valorAtual);
    },
  };
}

export function campoSegmentos(def, ctx) {
  const pilula = criar("span", { classe: "seg-pilula", "aria-hidden": "true" });
  const botoes = def.opcoes.map(([valor, rotulo, nomeDoIcone, glifo]) =>
    criar(
      "button",
      {
        classe: "seg-opcao",
        type: "button",
        role: "radio",
        "aria-checked": "false",
        "aria-label": rotulo,
        "data-dica": rotulo,
        dados: { valor },
        on: {
          click: () => {
            def.aoMudar ? def.aoMudar(valor) : ctx.edicao.estilo(def.prop, valor);
            marcar(valor);
          },
        },
      },
      nomeDoIcone ? icone(nomeDoIcone, 15) : criar("span", { classe: "glifo", texto: glifo ?? rotulo }),
    ),
  );
  const grupo = criar("div", { classe: "seg", role: "radiogroup", "aria-label": def.rotulo }, pilula, botoes);
  const elemento = criar(
    "div",
    { classe: `campo ${def.classe ?? ""}`, "data-campo": def.prop ?? "" },
    def.semRotulo ? null : criar("span", { classe: "rotulo", texto: def.curto ?? def.rotulo }),
    grupo,
  );
  let primeiraVez = true;
  const vertical = (def.classe ?? "").includes("vertical");

  function marcar(valor) {
    let ativo = null;
    for (const botao of botoes) {
      const escolhido = def.equivale ? def.equivale(botao.dataset.valor, valor) : botao.dataset.valor === valor;
      botao.setAttribute("aria-checked", String(escolhido));
      if (escolhido) ativo = botao;
    }
    if (!ativo || !ativo.offsetWidth) {
      pilula.style.opacity = ativo ? pilula.style.opacity : "0";
      if (ativo) requestAnimationFrame(() => marcar(valor));
      return;
    }
    pilula.classList.toggle("sem-transicao", primeiraVez);
    pilula.style.opacity = "1";
    if (vertical) {
      pilula.style.height = `${ativo.offsetHeight}px`;
      pilula.style.transform = `translateY(${ativo.offsetTop}px)`;
    } else {
      pilula.style.width = `${ativo.offsetWidth}px`;
      pilula.style.transform = `translateX(${ativo.offsetLeft}px)`;
    }
    primeiraVez = false;
  }

  return {
    elemento,
    atualizar(estilo) {
      marcar((def.ler ? def.ler(estilo) : estilo.getPropertyValue(def.prop)).trim());
    },
  };
}

export function campoQuatro(def, ctx) {
  const nomes = ["top", "right", "bottom", "left"];
  const icones = ["setaCima", "setaDireita", "setaBaixo", "setaEsquerda"];
  let ligados = true;
  let valores = ["", "", "", ""];
  const unico = campoMedida(
    {
      rotulo: def.rotulo,
      icone: def.icone,
      prop: def.atalho,
      unidade: "px",
      minimo: def.minimo,
      classe: "cresce",
      ler: () => (valores.every((v) => v === valores[0]) ? valores[0] : "Mixed"),
    },
    ctx,
  );
  const lados = def.props.map((prop, i) =>
    campoMedida({ rotulo: `${def.rotulo} ${nomes[i]}`, prop, icone: icones[i], unidade: "px", minimo: def.minimo }, ctx),
  );
  const elo = criar(
    "button",
    { classe: "botao-icone pequeno elo", type: "button", "aria-pressed": "true", "data-dica": "Edit sides separately", "aria-label": "Edit sides separately" },
    icone("elo", 14),
  );
  const gradeDosLados = criar("div", { classe: "grade-quatro oculto" }, lados.map((lado) => lado.elemento));
  const elemento = criar(
    "div",
    { classe: "campo campo-quatro", "data-campo": def.atalho },
    criar("span", { classe: "rotulo", texto: def.curto ?? def.rotulo }),
    criar("div", { classe: "quatro-corpo" }, criar("div", { classe: "linha-quatro" }, unico.elemento, elo), gradeDosLados),
  );
  elo.addEventListener("click", () => {
    ligados = !ligados;
    elo.setAttribute("aria-pressed", String(ligados));
    elo.dataset.dica = ligados ? "Edit sides separately" : "Link all sides";
    elo.setAttribute("aria-label", elo.dataset.dica);
    gradeDosLados.classList.toggle("oculto", ligados);
    unico.elemento.classList.toggle("apagado", !ligados);
  });
  return {
    elemento,
    atualizar(estilo) {
      valores = def.props.map((prop) => formatar(estilo.getPropertyValue(prop)));
      unico.atualizar(estilo);
      for (const lado of lados) lado.atualizar(estilo);
    },
  };
}

export function abrirSeletorDeCor(ctx, { ancora, valor, elemento, aoEscolher, titulo = "Color", token = null }) {
  const rgba = rgbaDe(valor, elemento) ?? [0, 0, 0, 1];
  let [luz, croma, matiz] = oklchDeRgb(rgba);
  let alfa = rgba[3];
  let modo = "aqui";

  const hexAtual = () => {
    const base = hexDeOklch(luz, croma, matiz);
    return alfa < 0.999 ? base + Math.round(alfa * 255).toString(16).padStart(2, "0") : base;
  };

  const entradaHex = criar("input", { classe: "entrada hex", type: "text", spellcheck: "false", "aria-label": "Hex color", value: hexDeRgba(rgba).toUpperCase() });
  const amostraGrande = criar("div", { classe: "amostra-grande" });

  function deslizante(rotulo, minimo, maximo, passo, ler, gravar, fundo, mostrarValor) {
    const entrada = criar("input", { type: "range", min: minimo, max: maximo, step: passo, "aria-label": rotulo, classe: "deslizante" });
    const saida = criar("span", { classe: "deslizante-valor" });
    const linha = criar("label", { classe: "linha-deslizante" }, criar("span", { classe: "rotulo", texto: rotulo }), entrada, saida);
    entrada.addEventListener("input", () => {
      gravar(parseFloat(entrada.value));
      sincronizar("deslizante");
      escolher(hexAtual());
    });
    return { linha, entrada, saida, ler, fundo, mostrarValor };
  }

  const controles = [
    deslizante("Lightness", 0, 1, 0.005, () => luz, (v) => (luz = v), () => `linear-gradient(to right in oklch, oklch(0 ${croma} ${matiz}), oklch(1 ${croma} ${matiz}))`, (v) => `${Math.round(v * 100)}%`),
    deslizante("Intensity", 0, 0.37, 0.002, () => croma, (v) => (croma = v), () => `linear-gradient(to right in oklch, oklch(${luz} 0 ${matiz}), oklch(${luz} 0.37 ${matiz}))`, (v) => v.toFixed(2)),
    deslizante("Hue", 0, 360, 1, () => matiz, (v) => (matiz = v), () => `linear-gradient(to right in oklch longer hue, oklch(${luz} ${croma} 0), oklch(${luz} ${croma} 360))`, (v) => `${Math.round(v)}°`),
    deslizante("Opacity", 0, 1, 0.01, () => alfa, (v) => (alfa = v), () => `linear-gradient(to right, rgb(0 0 0 / 0), ${hexDeOklch(luz, croma, matiz)})`, (v) => `${Math.round(v * 100)}%`),
  ];

  function sincronizar(origem) {
    for (const controle of controles) {
      if (origem !== "deslizante" || ctx.raiz.activeElement !== controle.entrada) controle.entrada.value = String(controle.ler());
      controle.saida.textContent = controle.mostrarValor(controle.ler());
      controle.entrada.style.setProperty("--trilho", controle.fundo());
    }
    const hex = hexAtual();
    amostraGrande.style.setProperty("--cor", hex);
    if (ctx.raiz.activeElement !== entradaHex) entradaHex.value = hex.toUpperCase();
  }

  function escolher(resultado) {
    if (resultado.startsWith("#")) {
      const sem = resultado.slice(0, 7);
      const i = recentes.indexOf(sem);
      if (i >= 0) recentes.splice(i, 1);
      recentes.unshift(sem);
      recentes.length = Math.min(recentes.length, 10);
    }
    aoEscolher(resultado, modo === "token" ? token : null);
  }

  entradaHex.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    const texto = entradaHex.value.trim();
    const lido = rgbaDe(/^[0-9a-f]{3,8}$/i.test(texto) ? `#${texto}` : texto, elemento);
    if (!lido) return;
    [luz, croma, matiz] = oklchDeRgb(lido);
    alfa = lido[3];
    sincronizar("hex");
    escolher(hexAtual());
  });

  const tokens = ctx.tokensDeCor(elemento);
  const busca = criar("input", { classe: "entrada busca", type: "text", spellcheck: "false", placeholder: `Search ${tokens.length} tokens`, "aria-label": "Search color tokens" });
  const listaDeTokens = criar("div", { classe: "tokens", role: "listbox", "aria-label": "Project color tokens" });
  function desenharTokens() {
    const termo = busca.value.trim().toLowerCase();
    const visiveis = tokens.filter((t) => !termo || t.nome.toLowerCase().includes(termo) || t.hex.includes(termo)).slice(0, 80);
    listaDeTokens.replaceChildren(
      ...visiveis.map((t) =>
        criar(
          "button",
          { classe: "token", type: "button", role: "option", translate: "no", "data-dica": `${t.nome}: ${t.valor}`, on: { click: () => escolher(`var(${t.nome})`) } },
          criar("span", { classe: "amostra-pequena", estilo: { "--cor": t.valor } }),
          criar("span", { classe: "token-nome", texto: t.nome.replace(/^--/, "") }),
          criar("span", { classe: "token-hex", texto: t.hex.replace("#", "").toUpperCase() }),
        ),
      ),
    );
    if (!visiveis.length) listaDeTokens.append(criar("p", { classe: "vazio", texto: tokens.length ? "No token with that name." : "This page declares no color tokens." }));
  }
  busca.addEventListener("input", desenharTokens);

  let escolhaDoToken = null;
  if (token) {
    const pilula = criar("span", { classe: "seg-pilula sem-transicao", "aria-hidden": "true" });
    const so = criar("button", { classe: "seg-opcao", type: "button", role: "radio", "aria-checked": "true", texto: "Only this element", "data-dica": "Changes the color of this element only" });
    const todo = criar("button", { classe: "seg-opcao", type: "button", role: "radio", "aria-checked": "false", texto: "The whole token", "data-dica": `Changes ${token} across the whole site` });
    escolhaDoToken = criar("div", { classe: "seg largo", role: "radiogroup", "aria-label": "What to change" }, pilula, so, todo);
    const marcar = (botao) => {
      for (const outro of [so, todo]) outro.setAttribute("aria-checked", String(outro === botao));
      pilula.style.opacity = "1";
      pilula.style.width = `${botao.offsetWidth}px`;
      pilula.style.transform = `translateX(${botao.offsetLeft}px)`;
      requestAnimationFrame(() => pilula.classList.remove("sem-transicao"));
    };
    so.addEventListener("click", () => {
      modo = "aqui";
      marcar(so);
    });
    todo.addEventListener("click", () => {
      modo = "token";
      marcar(todo);
    });
    requestAnimationFrame(() => marcar(so));
  }

  const conteudo = criar(
    "div",
    { classe: "seletor-de-cor" },
    criar("div", { classe: "pop-titulo" }, criar("span", { texto: titulo }), token ? criar("span", { classe: "selo-token", translate: "no" }, icone("token", 11), token.replace(/^--/, "")) : null),
    escolhaDoToken,
    criar("div", { classe: "linha-hex" }, amostraGrande, entradaHex),
    controles.map((controle) => controle.linha),
    recentes.length
      ? criar(
          "div",
          { classe: "recentes" },
          recentes.map((hex) => criar("button", { classe: "amostra-pequena botao", type: "button", "data-dica": hex.toUpperCase(), "aria-label": `Use ${hex}`, estilo: { "--cor": hex }, on: { click: () => escolher(hex) } })),
        )
      : null,
    criar("div", { classe: "pop-subtitulo", texto: "Project tokens" }),
    busca,
    listaDeTokens,
  );
  desenharTokens();
  sincronizar("inicio");
  ctx.topo.abrirPop(conteudo, ancora, { rotulo: titulo, focar: false });
  entradaHex.focus({ preventScroll: true });
}

export function campoCor(def, ctx) {
  const amostra = criar("button", { classe: "amostra", type: "button", "aria-label": `${def.rotulo}: open color picker`, "data-dica": def.rotulo });
  const entrada = criar("input", { classe: "num hex-campo", type: "text", spellcheck: "false", "aria-label": `${def.rotulo} hex`, autocomplete: "off" });
  const alfa = criar("input", { classe: "num alfa", type: "text", spellcheck: "false", inputmode: "numeric", "aria-label": `${def.rotulo} opacity`, autocomplete: "off" });
  const selo = criar("button", { classe: "selo-token oculto", type: "button", "data-dica": "Color from a token. Click to change it." });
  const caixa = criar("div", { classe: "campo-cor-caixa" }, amostra, entrada, selo, alfa);
  const elemento = criar(
    "div",
    { classe: `campo ${def.classe ?? ""}`, "data-campo": def.prop ?? "" },
    def.semRotulo ? null : criar("span", { classe: "rotulo", texto: def.curto ?? def.rotulo }),
    def.soAmostra ? amostra : caixa,
  );
  let bruto = "";
  let token = null;
  let rgbaAtual = [0, 0, 0, 0];

  function aplicar(valor, tokenEscolhido) {
    if (tokenEscolhido) ctx.mudarToken(tokenEscolhido, valor);
    else def.aoMudar ? def.aoMudar(valor) : ctx.edicao.estilo(def.prop, valor);
  }

  const abrir = () => {
    if (ctx.topo.popAberto()?.ancora === amostra) return ctx.topo.fecharPop(true);
    abrirSeletorDeCor(ctx, { ancora: amostra, valor: bruto, elemento: ctx.selecao.atual ?? document.documentElement, aoEscolher: aplicar, titulo: def.rotulo, token });
  };
  amostra.addEventListener("click", abrir);
  selo.addEventListener("click", abrir);
  entrada.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    const texto = entrada.value.trim();
    if (!texto) return;
    aplicar(/^[0-9a-f]{3,8}$/i.test(texto) ? `#${texto}` : texto, null);
  });
  alfa.addEventListener("keydown", (evento) => {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    const numero = parseFloat(alfa.value.replace("%", ""));
    if (Number.isNaN(numero)) return;
    const [r, g, b] = rgbaAtual;
    aplicar(hexDeRgba([r, g, b, limitar(numero / 100, 0, 1)]), null);
  });

  return {
    elemento,
    atualizar(estilo, alvo) {
      bruto = (def.ler ? def.ler(estilo) : estilo.getPropertyValue(def.prop)).trim();
      const declarado = def.prop ? ctx.declarado(def.prop) : null;
      const variavel = /^var\(\s*(--[\w-]+)\s*[,)]/.exec(declarado ?? "");
      token = variavel ? variavel[1] : null;
      rgbaAtual = rgbaDe(bruto, alvo) ?? [0, 0, 0, 0];
      const transparente = rgbaAtual[3] === 0;
      amostra.style.setProperty("--cor", bruto || "transparent");
      amostra.classList.toggle("transparente", transparente);
      amostra.dataset.dica = token ? `${def.rotulo}: ${token}` : `${def.rotulo}: ${transparente ? "none" : (hexDe(bruto, alvo) ?? bruto).toUpperCase()}`;
      selo.classList.toggle("oculto", !token);
      entrada.classList.toggle("oculto", Boolean(token));
      if (token) selo.replaceChildren(icone("token", 11), criar("span", { translate: "no", texto: token.replace(/^--/, "") }));
      if (!focado(ctx, entrada)) entrada.value = transparente ? "None" : (hexDeRgba([...rgbaAtual.slice(0, 3), 1]).replace("#", "").toUpperCase());
      entrada.classList.toggle("sem-cor", transparente);
      alfa.classList.toggle("oculto", transparente);
      if (!focado(ctx, alfa)) alfa.value = `${Math.round(rgbaAtual[3] * 100)}%`;
    },
  };
}

export function campoFonte(def, ctx) {
  const textoDoBotao = criar("span", { classe: "botao-lista-texto", translate: "no" });
  const botao = criar(
    "button",
    { classe: "botao-lista fonte", type: "button", "aria-haspopup": "listbox", "aria-label": def.rotulo, "data-dica": def.rotulo },
    textoDoBotao,
    criar("span", { classe: "seta-lista" }, icone("baixo", 12)),
  );
  const elemento = criar(
    "div",
    { classe: `campo ${def.classe ?? ""}`, "data-campo": def.prop ?? "font-family" },
    def.semRotulo ? null : criar("span", { classe: "rotulo", texto: def.curto ?? def.rotulo }),
    botao,
  );
  let pilha = "";

  botao.addEventListener("click", () => {
    if (ctx.topo.popAberto()?.ancora === botao) return ctx.topo.fecharPop(true);
    const atual = primeiraFonte(pilha);
    abrirLista(ctx, {
      ancora: botao,
      opcoes: ctx.fontes().map((fonte) => ({
        valor: fonte.nome,
        rotulo: fonte.nome,
        dado: true,
        detalhe: fonte.origem,
        estilo: { fontFamily: `"${fonte.nome}", ${fonte.generica ?? "sans-serif"}` },
      })),
      atual,
      busca: true,
      livre: true,
      largura: 264,
      rotulo: "Fonts",
      aoEscolher: async (nome) => {
        const resto = pilha.split(",").slice(1).join(",").trim() || "sans-serif";
        const valor = `"${nome}", ${resto}`;
        const externa = await ctx.carregarFonte(nome);
        def.aoMudar ? def.aoMudar(valor, externa) : ctx.edicao.estilo(def.prop ?? "font-family", valor, { fonteExterna: externa ? nome : undefined });
      },
    });
  });

  return {
    elemento,
    atualizar(estilo) {
      pilha = (def.ler ? def.ler(estilo) : estilo.getPropertyValue(def.prop ?? "font-family")).trim();
      textoDoBotao.textContent = primeiraFonte(pilha) || "—";
      textoDoBotao.style.fontFamily = pilha;
    },
  };
}

export function primeiraFonte(pilha) {
  return String(pilha ?? "").split(",")[0].trim().replace(/^["']|["']$/g, "");
}

function camadasDe(valor) {
  const camadas = [];
  let profundidade = 0;
  let atual = "";
  for (const letra of String(valor ?? "")) {
    if (letra === "(") profundidade++;
    else if (letra === ")") profundidade--;
    if (letra === "," && profundidade === 0) {
      camadas.push(atual.trim());
      atual = "";
    } else atual += letra;
  }
  if (atual.trim()) camadas.push(atual.trim());
  return camadas;
}

export function resumirSombra(valor) {
  const camadas = camadasDe(valor);
  if (!camadas.length || valor === "none") return "No shadow";
  const internas = camadas.filter((camada) => /\binset\b/.test(camada)).length;
  if (camadas.length === 1) return internas ? "Inner shadow" : "Custom shadow";
  return internas ? `${camadas.length} shadows, ${internas} inner` : `${camadas.length} shadows`;
}

const NOMES_DE_FILTRO = {
  saturate: "saturation",
  "hue-rotate": "hue rotation",
  "drop-shadow": "drop shadow",
};

export function resumirFiltro(valor) {
  const nomes = [...String(valor ?? "").matchAll(/([a-z-]+)\(/g)].map(([, nome]) => NOMES_DE_FILTRO[nome] ?? nome);
  if (!nomes.length) return String(valor ?? "");
  const texto = [...new Set(nomes)].join(" and ");
  return texto[0].toUpperCase() + texto.slice(1);
}

export function resumirColunas(valor) {
  const trilhas = String(valor ?? "").trim().split(/\s+(?![^(]*\))/).filter(Boolean);
  if (!trilhas.length || trilhas[0] === "none") return "None";
  return trilhas.length === 1 ? "1 column" : `${trilhas.length} columns`;
}

export function campoTexto(def, ctx) {
  const entrada = criar("input", { classe: "num livre", type: "text", spellcheck: "false", "aria-label": def.rotulo, placeholder: def.dica ?? "", autocomplete: "off" });
  const presets = def.presets
    ? criar("button", { classe: "modo", type: "button", "data-dica": "Presets", "aria-label": `${def.rotulo} presets` }, icone("baixo", 12))
    : null;
  const caixa = criar("label", { classe: "campo-num cresce" }, def.icone ? criar("span", { classe: "prefixo" }, icone(def.icone, 13)) : null, entrada, presets);
  const elemento = criar("div", { classe: `campo ${def.classe ?? ""}`, "data-campo": def.prop }, criar("span", { classe: "rotulo", texto: def.curto ?? def.rotulo }), caixa);
  let valorAtual = "";
  const mostrar = () => {
    const nome = def.presets?.find(([valor]) => valor === valorAtual)?.[1];
    const resumo = nome ?? PALAVRAS[valorAtual] ?? (def.resumir ? def.resumir(valorAtual) : valorAtual);
    entrada.value = focado(ctx, entrada) ? valorAtual : resumo;
    if (resumo !== valorAtual) caixa.dataset.dica = `${def.rotulo}: ${valorAtual}`;
    else delete caixa.dataset.dica;
  };
  function confirmar(valor) {
    const limpo = String(valor ?? "").trim();
    const conhecido = def.presets?.find(([, rotulo]) => rotulo.toLowerCase() === limpo.toLowerCase())?.[0];
    const final = conhecido ?? limpo;
    if (!final || final === valorAtual) return mostrar();
    valorAtual = final;
    mostrar();
    ctx.edicao.estilo(def.prop, final);
  }
  entrada.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter") {
      evento.preventDefault();
      confirmar(entrada.value);
    }
  });
  entrada.addEventListener("change", () => confirmar(entrada.value));
  entrada.addEventListener("focus", () => {
    mostrar();
    entrada.select();
  });
  entrada.addEventListener("blur", mostrar);
  presets?.addEventListener("click", (evento) => {
    evento.preventDefault();
    if (ctx.topo.popAberto()?.ancora === presets) return ctx.topo.fecharPop(true);
    abrirLista(ctx, {
      ancora: presets,
      opcoes: def.presets.map(([valor, rotulo]) => ({ valor, rotulo, detalhe: valor === "none" ? "" : valor })),
      atual: valorAtual,
      aoEscolher: confirmar,
      rotulo: def.rotulo,
      largura: 290,
    });
  });
  return {
    elemento,
    atualizar(estilo) {
      valorAtual = estilo.getPropertyValue(def.prop).trim();
      if (!focado(ctx, entrada) || entrada.dataset.sujo !== "1") mostrar();
    },
  };
}

const EIXO = ["flex-start", "center", "flex-end"];

function normalizarEixo(valor) {
  const v = String(valor ?? "").trim();
  if (["start", "flex-start", "left", "normal", "stretch", "baseline", "self-start"].includes(v)) return "flex-start";
  if (["end", "flex-end", "right", "self-end"].includes(v)) return "flex-end";
  if (v === "center") return "center";
  return v;
}

export function campoAlinhamento(def, ctx) {
  const celulas = [];
  const grade = criar("div", { classe: "grade-alinhamento", role: "grid", "aria-label": "Child alignment" });
  let coluna = false;
  for (let linha = 0; linha < 3; linha++) {
    for (let col = 0; col < 3; col++) {
      const celula = criar("button", {
        classe: "celula",
        type: "button",
        "aria-pressed": "false",
        on: {
          click: () => {
            ctx.edicao.estilo("justify-content", EIXO[coluna ? linha : col]);
            ctx.edicao.estilo("align-items", EIXO[coluna ? col : linha]);
          },
        },
      });
      celula.dataset.linha = String(linha);
      celula.dataset.col = String(col);
      celulas.push(celula);
      grade.append(celula);
    }
  }
  const distribuir = campoSegmentos(
    {
      rotulo: "Distribution",
      prop: "justify-content",
      semRotulo: true,
      classe: "vertical",
      opcoes: [
        ["flex-start", "Packed together at the start", null, "Packed"],
        ["space-between", "Spread out to the edges", null, "Between"],
        ["space-around", "Equal space around each", null, "Around"],
      ],
      equivale: (botao, valor) => (botao === "flex-start" ? !["space-between", "space-around", "space-evenly"].includes(valor) : botao === valor),
    },
    ctx,
  );
  const elemento = criar(
    "div",
    { classe: "campo campo-alinhamento", "data-campo": "alinhamento" },
    criar("span", { classe: "rotulo", texto: def.rotulo }),
    criar("div", { classe: "alinhamento-corpo" }, grade, distribuir.elemento),
  );
  return {
    elemento,
    atualizar(estilo) {
      coluna = estilo.flexDirection.startsWith("column");
      const principal = normalizarEixo(estilo.justifyContent);
      const cruzado = normalizarEixo(estilo.alignItems);
      for (const celula of celulas) {
        const linha = Number(celula.dataset.linha);
        const col = Number(celula.dataset.col);
        const valorPrincipal = EIXO[coluna ? linha : col];
        const valorCruzado = EIXO[coluna ? col : linha];
        celula.setAttribute("aria-pressed", String(valorPrincipal === principal && valorCruzado === cruzado));
        celula.setAttribute("aria-label", `Align: main axis ${valorPrincipal}, cross axis ${valorCruzado}`);
      }
      distribuir.atualizar(estilo);
    },
  };
}
