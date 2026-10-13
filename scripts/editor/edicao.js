import { descreverAlvo, regrasDaPropriedade, marcaDeTema, nomeDoTema } from "./elementos.js";
import { novoId, propriedadeSegura, valorSeguro } from "./utilitarios.js";
import { ehCor } from "./cor.js";

const PROPRIEDADES_DE_COR =
  /^(color|background|background-color|background-image|border-color|border-(top|right|bottom|left)-color|outline-color|box-shadow|text-shadow|fill|stroke|caret-color|accent-color|text-decoration-color|column-rule-color)$/;

export function criarEdicao(ctx) {
  const { loja } = ctx;

  function escopoPara(propriedade, valor, elemento) {
    const marca = marcaDeTema(loja.config);
    if (!marca) return null;
    if (PROPRIEDADES_DE_COR.test(propriedade)) return marca;
    if (propriedade.startsWith("--") && ehCor(valor, elemento)) return marca;
    return null;
  }

  function base(alvo, extra = {}) {
    return {
      alvo,
      pagina: location.pathname,
      largura: innerWidth,
      tema: nomeDoTema(marcaDeTema(loja.config)),
      ...extra,
    };
  }

  function estilo(propriedade, valor, opcoes = {}) {
    const elemento = opcoes.elemento ?? ctx.selecao.atual;
    if (!elemento || !propriedadeSegura(propriedade)) return null;
    const depois = valorSeguro(valor);
    if (!depois) return null;
    const alcance = opcoes.alcance ?? ctx.alcance();
    const alvo = opcoes.alvo ?? (elemento === ctx.selecao.atual && alcance === ctx.alcance() ? ctx.alvoAtual() : descreverAlvo(elemento, alcance));
    const escopoDeTema = opcoes.semTema ? null : escopoPara(propriedade, depois, elemento);
    const chave = ["estilo", alvo.seletor, propriedade, escopoDeTema ?? ""].join("|");
    const anterior = loja.abertaPorChave(chave);
    const antesCalculado = anterior?.antesCalculado ?? loja.medirSeletor(alvo.seletor, propriedade, escopoDeTema, { semTransicao: true });
    const regras = anterior?.regras ?? regrasDaPropriedade(elemento, propriedade);
    const antes = anterior?.antes ?? regras.find((regra) => regra.vence)?.valor ?? antesCalculado[0] ?? "";
    const mudanca = {
      id: anterior?.id ?? novoId(),
      chave,
      tipo: "estilo",
      propriedade,
      antes,
      depois,
      antesCalculado,
      regras,
      escopoDeTema,
      ...base(alvo),
      fonteExterna: opcoes.fonteExterna ?? anterior?.fonteExterna,
      origemDoPedido: opcoes.origem ?? anterior?.origemDoPedido,
    };
    loja.definir(mudanca);
    mudanca.depoisCalculado = loja.medirSeletor(alvo.seletor, propriedade, escopoDeTema, { semTransicao: true });
    const voltou =
      mudanca.depoisCalculado.length > 0 &&
      mudanca.depoisCalculado.length === antesCalculado.length &&
      mudanca.depoisCalculado.every((medido, i) => medido === antesCalculado[i]);
    if (voltou) {
      loja.remover(mudanca.id);
      if (anterior) loja.registrarPasso([{ chave, anterior, posterior: null }]);
      return null;
    }
    loja.definir(mudanca);
    loja.registrarPasso([{ chave, anterior, posterior: mudanca }]);
    return mudanca;
  }

  function texto(elemento, antes, depois) {
    const alvo = descreverAlvo(elemento, "este");
    const chave = ["texto", alvo.seletor, location.pathname].join("|");
    const anterior = loja.abertaPorChave(chave);
    const original = anterior?.antes ?? antes;
    if (depois === original) {
      if (anterior) {
        loja.remover(anterior.id);
        loja.registrarPasso([{ chave, anterior, posterior: null }]);
      }
      return null;
    }
    const mudanca = { id: anterior?.id ?? novoId(), chave, tipo: "texto", antes: original, depois, ...base(alvo) };
    loja.definir(mudanca);
    loja.registrarPasso([{ chave, anterior, posterior: mudanca }]);
    return mudanca;
  }

  function nota(tipo, elemento, conteudo, extra = {}) {
    const textoLimpo = String(conteudo ?? "").trim();
    if (!textoLimpo || !elemento) return null;
    const id = novoId();
    const mudanca = { id, chave: `${tipo}|${id}`, tipo, texto: textoLimpo, ...base(descreverAlvo(elemento, "este"), extra) };
    loja.definir(mudanca);
    loja.registrarPasso([{ chave: mudanca.chave, anterior: null, posterior: mudanca }]);
    return mudanca;
  }

  function editarNota(mudanca, conteudo) {
    const textoLimpo = String(conteudo ?? "").trim();
    if (!textoLimpo) return remover([mudanca]);
    const nova = { ...mudanca, texto: textoLimpo };
    loja.definir(nova);
    loja.registrarPasso([{ chave: mudanca.chave, anterior: mudanca, posterior: nova }]);
  }

  function remover(mudancas) {
    const lista = mudancas.filter(Boolean);
    if (!lista.length) return;
    loja.remover(lista.map((m) => m.id));
    loja.registrarPasso(lista.map((m) => ({ chave: m.chave, anterior: m, posterior: null })));
  }

  function doElemento(elemento) {
    return loja.abertas().filter((m) => {
      try {
        return elemento.matches(m.alvo?.seletor);
      } catch {
        return false;
      }
    });
  }

  return {
    estilo,
    texto,
    comentar: (elemento, conteudo) => nota("comentario", elemento, conteudo),
    pedir: (elemento, conteudo, extra) => nota("pedido", elemento, conteudo, extra),
    editarNota,
    remover,
    doElemento,
    resetarElemento: (elemento) => remover(doElemento(elemento)),
  };
}
