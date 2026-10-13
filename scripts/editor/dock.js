import { criar, textoCurto, primeiro, contar, copiarTexto } from "./utilitarios.js";
import { icone } from "./icones.js";
import { ehAberta } from "./loja.js";
import { hexDe, rgbaDe, oklchDeRgb, hexDeOklch, ehCor } from "./cor.js";
import { nomesDeTokens, descreverAlvo } from "./elementos.js";

const ROTULOS_DE_SITUACAO = {
  pendente: "Pending",
  aplicada: "Applied, checking",
  conferida: "Verified",
  divergente: "Mismatch",
};

const NOMES_DE_NOTA = { comentario: "comment", pedido: "request" };

const NOMES_DE_PROPRIEDADE = {
  "font-family": "font",
  "font-size": "font size",
  "font-weight": "weight",
  "font-style": "font style",
  "line-height": "line height",
  "letter-spacing": "letter spacing",
  "text-align": "text align",
  "text-transform": "case",
  "text-decoration-line": "underline",
  color: "text color",
  "background-color": "background",
  "border-radius": "corner radius",
  "border-width": "border width",
  "border-style": "border style",
  "border-color": "border color",
  "box-shadow": "shadow",
  "backdrop-filter": "glass",
  rotate: "rotation",
};

const plural = (quantos, palavra) => `${quantos} ${palavra}${quantos === 1 ? "" : "s"}`;

function descrever(m) {
  if (m.tipo === "estilo") {
    const nome = NOMES_DE_PROPRIEDADE[m.propriedade] ?? m.propriedade;
    return { titulo: nome, detalhe: `${textoCurto(m.antes, 26) || "—"} → ${textoCurto(m.depois, 26)}` };
  }
  if (m.tipo === "texto") return { titulo: "text", detalhe: `"${textoCurto(m.antes, 22)}" → "${textoCurto(m.depois, 22)}"` };
  return { titulo: NOMES_DE_NOTA[m.tipo] ?? m.tipo, detalhe: textoCurto(m.texto, 60) };
}

function cssDasMudancas(lista) {
  const linhas = [];
  const estilos = lista.filter((m) => m.tipo === "estilo");
  const notas = lista.filter((m) => m.tipo !== "estilo");
  if (estilos.length) {
    linhas.push(`/* redesign mode: ${plural(estilos.length, "style change")} */`);
    for (const m of estilos) {
      const onde = m.regras?.find((r) => r.vence)?.origem;
      const comentario = [`was ${m.antes}`, onde ? `in ${onde}` : null, m.tema ? `theme ${m.tema}` : null, `at ${m.largura}px wide`].filter(Boolean).join(", ");
      linhas.push(`${m.alvo?.seletor} { ${m.propriedade}: ${m.depois}; } /* ${comentario} */`);
    }
  }
  for (const m of notas) {
    if (m.tipo === "texto") linhas.push(`/* text in ${m.alvo?.seletor} (${m.pagina}): "${m.antes}" becomes "${m.depois}" */`);
    else linhas.push(`/* ${NOMES_DE_NOTA[m.tipo] ?? m.tipo} on ${m.alvo?.seletor} (${m.pagina}): ${m.texto} */`);
  }
  return linhas.join("\n");
}

export function criarDock(ctx) {
  const contador = criar("span", { classe: "contador oculto" });
  const botaoEditar = criar("button", { classe: "dock-botao principal", type: "button", "aria-pressed": "false", "data-dica": "Edit the page", "data-atalho": "E" }, icone("cursor", 15), criar("span", { texto: "Edit" }), contador);
  const botaoPainel = criar("button", { classe: "dock-botao", type: "button", "aria-pressed": "false", "data-dica": "Properties panel", "data-atalho": "P", "aria-label": "Properties panel" }, icone("painel", 15));
  const botaoAcento = criar("button", { classe: "dock-botao", type: "button", "data-dica": "Accent color", "aria-label": "Accent color", "aria-haspopup": "dialog" }, icone("paleta", 15));
  const botaoFonte = criar("button", { classe: "dock-botao", type: "button", "data-dica": "Typography", "aria-label": "Typography", "aria-haspopup": "dialog" }, icone("fonte", 15));
  const botaoMudancas = criar("button", { classe: "dock-botao", type: "button", "data-dica": "Changes", "aria-label": "Changes", "aria-haspopup": "dialog" }, icone("mudancas", 15));
  const presenca = criar("span", { classe: "presenca", "aria-hidden": "true" });
  const botaoClaude = criar("button", { classe: "dock-botao claude", type: "button" }, presenca, criar("span", { texto: "Claude" }), icone("enviar", 13));
  const avisoDeConexao = criar(
    "div",
    { classe: "aviso-fixo aviso-conexao oculto", role: "status", "aria-live": "polite" },
    criar("span", { classe: "aviso-fixo-ponto", "aria-hidden": "true" }),
    criar("strong", { classe: "aviso-fixo-texto", texto: "Can't reach the redesign server. Retrying…" }),
  );
  const aviso = criar("div", { classe: "aviso oculto", role: "status", "aria-live": "polite" });
  const botaoRecarregar = criar("button", { classe: "botao primario compacto", type: "button", texto: "Reload" });
  const avisoDeVersao = criar(
    "div",
    { classe: "aviso-fixo aviso-versao oculto", role: "status", "aria-live": "polite" },
    criar("span", { classe: "aviso-fixo-ponto", "aria-hidden": "true" }),
    criar("strong", { classe: "aviso-fixo-texto", texto: "Redesign mode was updated" }),
    botaoRecarregar,
  );
  const dock = criar(
    "div",
    { popover: "manual", classe: "dock ferramenta", role: "toolbar", "aria-label": "Redesign mode" },
    aviso,
    avisoDeConexao,
    avisoDeVersao,
    criar("div", { classe: "dock-pilula vidro" }, botaoEditar, criar("span", { classe: "divisoria" }), botaoPainel, botaoAcento, botaoFonte, botaoMudancas, criar("span", { classe: "divisoria" }), botaoClaude),
  );
  ctx.raiz.append(dock);
  ctx.topo.fixar(dock);

  function marcarPresenca(ouvindo) {
    presenca.dataset.estado = ouvindo ? "ouvindo" : "ausente";
    botaoClaude.dataset.dica = ouvindo ? "Claude is listening. Send the changes to apply them in code." : 'Claude isn\'t listening. Type "apply the redesign" in its terminal.';
    botaoClaude.setAttribute("aria-label", ouvindo ? "Send the changes to Claude, who is listening" : "Send the changes to Claude, who isn't listening");
  }
  marcarPresenca(false);

  let temporizadorDoAviso = null;
  function mostrarAviso({ texto, tipo = "info" }) {
    aviso.textContent = texto;
    aviso.dataset.tipo = tipo;
    aviso.classList.remove("oculto");
    clearTimeout(temporizadorDoAviso);
    temporizadorDoAviso = setTimeout(() => aviso.classList.add("oculto"), tipo === "erro" ? 7000 : 4000);
  }

  botaoEditar.addEventListener("click", () => ctx.selecao.alternar());
  botaoPainel.addEventListener("click", () => ctx.abrirOuFecharPainel());
  botaoAcento.addEventListener("click", () => (ctx.topo.popAberto()?.ancora === botaoAcento ? ctx.topo.fecharPop(true) : abrirAcento()));
  botaoFonte.addEventListener("click", () => (ctx.topo.popAberto()?.ancora === botaoFonte ? ctx.topo.fecharPop(true) : abrirTipografia()));
  botaoMudancas.addEventListener("click", () => (ctx.topo.popAberto()?.ancora === botaoMudancas ? ctx.topo.fecharPop(true) : abrirMudancas()));
  botaoClaude.addEventListener("click", () => mandar(""));
  botaoRecarregar.addEventListener("click", async () => {
    botaoRecarregar.disabled = true;
    try {
      await ctx.loja.esvaziar();
      location.reload();
    } catch (erro) {
      botaoRecarregar.disabled = false;
      mostrarAviso({ texto: `Didn't reload: ${erro.message}. The last change hasn't reached the server yet.`, tipo: "erro" });
    }
  });

  async function mandar(nota) {
    const abertas = ctx.loja.abertas();
    if (!abertas.length && !nota) return mostrarAviso({ texto: "No pending changes to send." });
    try {
      const resposta = await ctx.loja.pedirAoClaude(nota);
      if (resposta.claudesOuvindo > 0) mostrarAviso({ texto: `Sent ${plural(resposta.pendentes, "change")} to Claude.`, tipo: "ok" });
      else mostrarAviso({ texto: 'Claude isn\'t listening right now. Type "apply the redesign" in its terminal.', tipo: "erro" });
    } catch (erro) {
      mostrarAviso({ texto: `Couldn't send: ${erro.message}`, tipo: "erro" });
    }
  }

  function tokensDoAcento() {
    const configurados = ctx.loja.config.acento?.tokens;
    if (Array.isArray(configurados) && configurados.length) return configurados;
    const estilo = getComputedStyle(document.documentElement);
    return nomesDeTokens()
      .filter((nome) => /marca|brand|accent|acento|primar|destaque/i.test(nome))
      .filter((nome) => ehCor(estilo.getPropertyValue(nome).trim()))
      .slice(0, 1);
  }

  function aplicarAcento(valor) {
    const tokens = tokensDoAcento();
    for (const token of tokens) ctx.mudarToken(token, valor, { semTema: true, origem: "accent switch" });
  }

  function abrirAcento() {
    const tokens = tokensDoAcento();
    if (!tokens.length) {
      mostrarAviso({ texto: "Couldn't find this page's accent token. Claude can set it in .redesign/config.json.", tipo: "erro" });
      return;
    }
    const dono = ctx.alvoDoToken(tokens[0]).dono;
    const atual = getComputedStyle(dono).getPropertyValue(tokens[0]).trim();
    const hexAtual = hexDe(atual) ?? "#888888";
    const [luz, croma, matiz] = oklchDeRgb(rgbaDe(hexAtual) ?? [136, 136, 136, 1]);
    const configuradas = ctx.loja.config.acento?.amostras;
    const amostras = Array.isArray(configuradas) && configuradas.length
      ? configuradas
      : [
          { nome: "Current", valor: hexAtual },
          ...[40, 150, 210, 265, 330].map((giro, i) => ({ nome: `Alternative ${i + 1}`, valor: hexDeOklch(luz, croma, (matiz + giro) % 360) })),
        ];
    const saidaHex = criar("code", { classe: "hex-saida", texto: hexAtual });
    const copiar = criar("button", { classe: "botao-icone pequeno", type: "button", "data-dica": "Copy hex", "aria-label": "Copy hex" }, icone("copiar", 13));
    copiar.addEventListener("click", async () => {
      const copiou = await copiarTexto(saidaHex.textContent);
      mostrarAviso(copiou ? { texto: `${saidaHex.textContent} copied.`, tipo: "ok" } : { texto: "Couldn't copy to the clipboard.", tipo: "erro" });
    });
    let valores = { luz, croma, matiz };
    function deslizante(rotulo, chave, minimo, maximo, passo) {
      const entrada = criar("input", { type: "range", classe: "deslizante", min: minimo, max: maximo, step: passo, value: valores[chave], "aria-label": rotulo });
      entrada.addEventListener("input", () => {
        valores[chave] = parseFloat(entrada.value);
        const hex = hexDeOklch(valores.luz, valores.croma, valores.matiz);
        saidaHex.textContent = hex;
        aplicarAcento(hex);
        pintarTrilhos();
      });
      return { linha: criar("label", { classe: "linha-deslizante" }, criar("span", { classe: "rotulo", texto: rotulo }), entrada), entrada, chave };
    }
    const controles = [deslizante("Darkness", "luz", 0.2, 0.95, 0.005), deslizante("Intensity", "croma", 0, 0.37, 0.002), deslizante("Hue", "matiz", 0, 360, 1)];
    function pintarTrilhos() {
      const { luz: l, croma: c, matiz: h } = valores;
      controles[0].entrada.style.setProperty("--trilho", `linear-gradient(to right in oklch, oklch(0.2 ${c} ${h}), oklch(0.95 ${c} ${h}))`);
      controles[1].entrada.style.setProperty("--trilho", `linear-gradient(to right in oklch, oklch(${l} 0 ${h}), oklch(${l} 0.37 ${h}))`);
      controles[2].entrada.style.setProperty("--trilho", `linear-gradient(to right in oklch longer hue, oklch(${l} ${c} 0), oklch(${l} ${c} 360))`);
    }
    const conteudo = criar(
      "div",
      { classe: "acento" },
      criar("div", { classe: "pop-titulo" }, criar("span", { texto: "Accent color" }), criar("span", { classe: "detalhe", translate: "no", texto: tokens.join(", ") })),
      criar(
        "div",
        { classe: "amostras", role: "group", "aria-label": "Swatches" },
        amostras.map((amostra) =>
          criar(
            "button",
            {
              classe: "amostra-acento",
              type: "button",
              translate: "no",
              "data-dica": `${amostra.nome}: ${amostra.valor}`,
              "aria-label": amostra.nome,
              on: {
                click: () => {
                  const hex = hexDe(amostra.valor) ?? amostra.valor;
                  saidaHex.textContent = hex;
                  const [l, c, h] = oklchDeRgb(rgbaDe(hex) ?? [0, 0, 0, 1]);
                  valores = { luz: l, croma: c, matiz: h };
                  controles.forEach((controle) => (controle.entrada.value = String(valores[controle.chave])));
                  pintarTrilhos();
                  aplicarAcento(amostra.valor);
                },
              },
            },
            criar("span", { classe: "bolinha", estilo: { background: amostra.valor } }),
            criar("span", { classe: "amostra-nome", texto: amostra.nome }),
          ),
        ),
      ),
      criar("div", { classe: "pop-subtitulo", texto: "Tune" }),
      controles.map((controle) => controle.linha),
      criar("div", { classe: "linha-hex" }, saidaHex, copiar),
    );
    pintarTrilhos();
    ctx.topo.abrirPop(conteudo, botaoAcento, { lado: "cima", rotulo: "Accent color" });
  }

  function papeisDaTipografia() {
    const tokens = ctx.loja.config.tipografia?.tokens ?? {};
    const lista = (valor) => [valor ?? []].flat().filter((nome) => typeof nome === "string" && nome.startsWith("--"));
    return [
      { papel: "titulo", rotulo: "Headings", tokens: lista(tokens.titulo), seletor: "h1, h2, h3, h4, h5, h6" },
      { papel: "texto", rotulo: "Body", tokens: lista(tokens.texto), seletor: "body" },
      { papel: "mono", rotulo: "Mono", tokens: lista(tokens.mono), seletor: "code, pre, kbd, samp" },
    ];
  }

  async function aplicarPar(par) {
    for (const { papel, tokens, seletor, rotulo } of papeisDaTipografia()) {
      const fonte = par[papel];
      if (!fonte) continue;
      const externa = await ctx.carregarFonte(fonte);
      const generica = papel === "mono" ? "monospace" : par.genericas?.[papel] ?? "sans-serif";
      const valor = `"${fonte}", ${generica}`;
      if (tokens.length) {
        for (const token of tokens) {
          ctx.mudarToken(token, valor, { semTema: true, origem: `typography: ${par.nome}`, fonteExterna: externa ? fonte : undefined });
        }
      } else {
        const exemplo = primeiro(seletor);
        if (!exemplo) continue;
        ctx.edicao.estilo("font-family", valor, {
          elemento: exemplo,
          semTema: true,
          origem: `typography: ${par.nome}`,
          fonteExterna: externa ? fonte : undefined,
          alvo: { ...descreverAlvo(exemplo, "todos"), seletor, quantos: contar(seletor), elemento: rotulo.toLowerCase() },
        });
      }
    }
    mostrarAviso({ texto: `Typography "${par.nome}" applied.`, tipo: "ok" });
  }

  function abrirTipografia() {
    const configurados = ctx.loja.config.tipografia?.pares;
    const fonteDe = (seletor) => getComputedStyle(primeiro(seletor) ?? document.body).fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
    const atual = { nome: "Current", titulo: fonteDe("h1, h2, h3"), texto: fonteDe("p, body"), mono: fonteDe("code, pre") };
    const pares = Array.isArray(configurados) && configurados.length
      ? configurados
      : [
          atual,
          { nome: "Neutral", titulo: "Inter", texto: "Inter", mono: "JetBrains Mono" },
          { nome: "Editorial", titulo: "Fraunces", texto: "Inter", mono: "IBM Plex Mono", genericas: { titulo: "serif" } },
          { nome: "Technical", titulo: "Space Grotesk", texto: "IBM Plex Sans", mono: "IBM Plex Mono" },
          { nome: "Narrow", titulo: "Instrument Sans", texto: "Geist", mono: "Geist Mono" },
        ];
    const conteudo = criar(
      "div",
      { classe: "tipografia" },
      criar("div", { classe: "pop-titulo" }, criar("span", { texto: "Typography" }), criar("span", { classe: "detalhe", texto: configurados ? "project" : "suggested" })),
      pares.map((par) =>
        criar(
          "button",
          { classe: "par", type: "button", translate: "no", on: { click: () => aplicarPar(par) } },
          criar("span", { classe: "par-nome", texto: par.nome }),
          criar("span", { classe: "par-titulo", texto: par.titulo, estilo: { fontFamily: `"${par.titulo}", ${par.genericas?.titulo ?? "sans-serif"}` } }),
          criar("span", { classe: "par-texto", texto: `${par.texto}${par.mono ? ` · ${par.mono}` : ""}`, estilo: { fontFamily: `"${par.texto}", sans-serif` } }),
        ),
      ),
    );
    ctx.topo.abrirPop(conteudo, botaoFonte, { lado: "cima", rotulo: "Typography" });
    for (const par of pares) for (const fonte of [par.titulo, par.texto]) if (fonte) ctx.carregarFonte(fonte, { silencioso: true });
  }

  function abrirMudancas() {
    const lista = criar("div", { classe: "lista-mudancas" });
    const recado = criar("textarea", {
      classe: "entrada area",
      rows: "2",
      lang: document.documentElement.lang || undefined,
      placeholder: "Note for Claude with the changes (optional)",
      "aria-label": "Note for Claude",
    });
    const desfazer = criar("button", { classe: "botao-icone pequeno", type: "button", "data-dica": "Undo", "data-atalho": "Ctrl+Z", "aria-label": "Undo" }, icone("desfazer", 13));
    const refazer = criar("button", { classe: "botao-icone pequeno", type: "button", "data-dica": "Redo", "data-atalho": "Ctrl+Shift+Z", "aria-label": "Redo" }, icone("refazer", 13));
    desfazer.addEventListener("click", () => ctx.loja.desfazer());
    refazer.addEventListener("click", () => ctx.loja.refazer());
    const contagem = criar("span", { classe: "detalhe" });
    const textoDoMandar = criar("span");
    const botaoMandar = criar(
      "button",
      { classe: "botao primario largo", type: "button", on: { click: () => mandar(recado.value.trim()).then(() => (recado.value = "")) } },
      icone("enviar", 14),
      textoDoMandar,
    );

    function desenhar() {
      const todas = ctx.loja.vista().mudancas;
      const abertas = todas.filter(ehAberta);
      contagem.textContent = `${abertas.length} pending · ${todas.length - abertas.length} in history`;
      textoDoMandar.textContent = `Send ${plural(abertas.length, "change")} to Claude`;
      botaoMandar.disabled = abertas.length === 0;
      desfazer.disabled = !ctx.loja.podeDesfazer();
      refazer.disabled = !ctx.loja.podeRefazer();
      const ordenadas = [...todas].reverse();
      lista.replaceChildren(
        ...ordenadas.slice(0, 120).map((m) => {
          const { titulo, detalhe } = descrever(m);
          const remover = ehAberta(m)
            ? criar("button", { classe: "botao-icone pequeno", type: "button", "data-dica": "Discard this change", "aria-label": "Discard this change", on: { click: (e) => { e.stopPropagation(); ctx.edicao.remover([m]); } } }, icone("fechar", 12))
            : null;
          const item = criar(
            "div",
            { classe: `mudanca situacao-${m.situacao}`, tabindex: "0", role: "button", "data-dica": m.alvo?.seletor ?? "" },
            criar(
              "div",
              { classe: "mudanca-cabeca" },
              criar("span", { classe: "mudanca-alvo", translate: "no", texto: m.alvo?.componentes?.[0] ?? m.alvo?.elemento ?? "?" }),
              criar("span", { classe: "mudanca-tipo", texto: titulo }),
              criar("span", { classe: "selo", texto: ROTULOS_DE_SITUACAO[m.situacao] ?? m.situacao }),
              remover,
            ),
            criar("div", { classe: "mudanca-detalhe", translate: "no", texto: detalhe }),
            m.situacao === "divergente" && m.conferencia
              ? criar("div", { classe: "mudanca-divergencia", texto: m.conferencia.motivo ?? `expected ${m.conferencia.esperado}, the code gives ${m.conferencia.medido}` })
              : null,
            m.pagina && m.pagina !== location.pathname ? criar("div", { classe: "mudanca-pagina", texto: `on ${m.pagina}` }) : null,
          );
          const elemento = () => (m.pagina === location.pathname || m.alvo?.alcance === "todos" ? primeiro(m.alvo?.seletor) : null);
          item.addEventListener("pointerenter", () => ctx.destacar(elemento()));
          item.addEventListener("pointerleave", () => ctx.destacar(null));
          item.addEventListener("click", () => {
            const alvo = elemento();
            if (!alvo) return mostrarAviso({ texto: m.pagina !== location.pathname ? `That change belongs to the page ${m.pagina}.` : "Couldn't find that element on this page." });
            if (!ctx.selecao.ativo) ctx.selecao.ligar();
            alvo.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
            ctx.selecao.selecionar(alvo);
          });
          item.addEventListener("keydown", (e) => {
            if (e.key === "Enter") item.click();
          });
          return item;
        }),
      );
      if (!todas.length) lista.append(criar("p", { classe: "vazio", texto: "No changes yet. Turn on Edit, click an element and adjust it." }));
    }

    const conteudo = criar(
      "div",
      { classe: "mudancas" },
      criar("div", { classe: "pop-titulo" }, criar("span", { texto: "Changes" }), contagem, criar("span", { classe: "espaco" }), desfazer, refazer),
      lista,
      recado,
      criar(
        "div",
        { classe: "mudancas-acoes" },
        criar("button", {
          classe: "botao discreto",
          type: "button",
          texto: "Copy as CSS",
          on: {
            click: async () => {
              const copiou = await copiarTexto(cssDasMudancas(ctx.loja.abertas()));
              mostrarAviso(copiou ? { texto: "Changes copied as CSS.", tipo: "ok" } : { texto: "Couldn't copy to the clipboard.", tipo: "erro" });
            },
          },
        }),
        criar("button", { classe: "botao discreto perigo", type: "button", texto: "Discard pending", on: { click: () => ctx.loja.limpar() } }),
        criar("button", { classe: "botao discreto", type: "button", texto: "Clear history", on: { click: () => ctx.loja.esquecerHistorico() } }),
      ),
      botaoMandar,
    );
    desenhar();
    const desligar = [ctx.ouvir("mudancas", desenhar), ctx.ouvir("historico", desenhar)];
    ctx.topo.abrirPop(conteudo, botaoMudancas, { lado: "cima", rotulo: "Changes", classe: "pop-largo", aoFechar: () => desligar.forEach((funcao) => funcao()), focar: false });
  }

  function atualizar() {
    const abertas = ctx.loja.abertas().length;
    contador.textContent = String(abertas);
    contador.classList.toggle("oculto", abertas === 0);
    botaoEditar.setAttribute("aria-pressed", String(ctx.selecao.ativo));
    botaoEditar.setAttribute("aria-label", `Edit the page, ${plural(abertas, "pending change")}`);
    botaoPainel.setAttribute("aria-pressed", String(ctx.painelAberto()));
    botaoClaude.disabled = abertas === 0;
  }

  ctx.ouvir("mudancas", atualizar);
  ctx.ouvir("modo", atualizar);
  ctx.ouvir("painel", atualizar);
  ctx.ouvir("aviso", mostrarAviso);
  ctx.ouvir("editorNovo", () => avisoDeVersao.classList.remove("oculto"));
  ctx.ouvir("claude", marcarPresenca);
  let temporizadorDaConexao = 0;
  ctx.ouvir("conexao", (ligado) => {
    clearTimeout(temporizadorDaConexao);
    if (ligado) return avisoDeConexao.classList.add("oculto");
    marcarPresenca(false);
    temporizadorDaConexao = setTimeout(() => avisoDeConexao.classList.remove("oculto"), 2000);
  });
  atualizar();
  return { mostrarAviso, abrirMudancas };
}
