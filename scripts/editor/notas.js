import { criar, textoCurto } from "./utilitarios.js";

export function criarNotas(ctx) {
  function abrir({ tipo = "comentario", ancora, rotulo, prefixo = "", dica = "", mudanca = null }) {
    const alvo = ctx.selecao.atual;
    if (!alvo && !mudanca) return;
    const nomeDoAlvo = mudanca ? mudanca.alvo?.elemento : ctx.alvoAtual()?.elemento;
    const area = criar("textarea", {
      classe: "entrada area",
      rows: "3",
      spellcheck: "true",
      lang: document.documentElement.lang || undefined,
      "data-foco": "",
      "aria-label": rotulo ?? "Text",
      placeholder: dica || (tipo === "pedido" ? "Describe what Claude should do here" : "What do you want to say about this element?"),
    });
    if (mudanca) area.value = mudanca.texto ?? "";
    const salvar = () => {
      const texto = area.value.trim();
      if (mudanca) ctx.edicao.editarNota(mudanca, texto);
      else if (texto) {
        if (tipo === "pedido") ctx.edicao.pedir(alvo, prefixo + texto);
        else ctx.edicao.comentar(alvo, texto);
      }
      ctx.topo.fecharPop(true);
    };
    area.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) {
        evento.preventDefault();
        salvar();
      }
    });
    const titulo = rotulo ?? (tipo === "pedido" ? "Request for Claude" : "Comment");
    const conteudo = criar(
      "div",
      { classe: "nota" },
      criar("div", { classe: "pop-titulo" }, criar("span", { texto: titulo }), criar("span", { classe: "detalhe", translate: "no", texto: textoCurto(nomeDoAlvo ?? "", 28) })),
      area,
      criar(
        "div",
        { classe: "nota-acoes" },
        mudanca
          ? criar("button", {
              classe: "botao perigo",
              type: "button",
              texto: "Delete",
              on: {
                click: () => {
                  ctx.edicao.remover([mudanca]);
                  ctx.topo.fecharPop(true);
                },
              },
            })
          : null,
        criar("span", { classe: "dica", texto: "Ctrl+Enter to save" }),
        criar("button", { classe: "botao primario", type: "button", texto: mudanca ? "Save" : tipo === "pedido" ? "Add request" : "Comment", on: { click: salvar } }),
      ),
    );
    ctx.topo.abrirPop(conteudo, ancora, { rotulo: titulo });
  }

  ctx.ouvir("abrirNota", ({ mudanca, ancora }) => abrir({ tipo: mudanca.tipo, ancora, mudanca }));
  return { abrir };
}
