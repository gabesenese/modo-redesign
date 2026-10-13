const ACENTO = /[À-ÖØ-öø-ÿ]/;
const DEFEITO = /\b(null|undefined|NaN)\b|\[object /;
const PALAVRAS_EM_PORTUGUES = new Set(
  `de da das dos um uma uns umas para pra com sem em na nas nos ou que por mais menos este esta estes estas esse essa isso isto
  aqui ainda todos todas nenhum nenhuma cada quando onde como nao voce tambem ja sao muda mudar mudou mudanca mudancas fundo texto
  textos fonte fontes cor cores borda raio sombra largura altura margem preenchimento tamanho peso linha linhas coluna colunas pilha
  bloco oculto oculta alinhar alinhamento desfazer refazer copiar copiado copiada copiadas mandar mandei recarregar editar comentar
  comentario salvar apagar fechar abrir selecione selecionar elemento elementos pai filho filhos irmaos pendente pendentes camada
  camadas regra regras efeitos vidro filtro escala rotacao opacidade tipografia projeto pagina tela arraste lados misto fixa seletor
  sugestoes procurar usar iguais igual tipo nada ligue clique mexa conectado servidor rodando atualizado pedido recado historico
  limpar descartar anotar transformar lista endereco caminho negrito italico sublinhado esquerda direita centro justificado posicao
  deslocamento arranjo direcao quebra distribuicao juntos pontas folga fino leve medio preto sutil flutuando desfoque desfocado claro
  escuro intensidade matiz luz escuridao ajustar amostras atual alternativa neutra tecnica estreita titulos conferindo aplicada
  conferida divergente bateu esperava codigo`.split(/\s+/),
);

function semPontuacao(palavra) {
  return palavra.replace(/^["'“‘(]+|["'”’.,;:!?)…]+$/g, "");
}

export function palavrasEmPortugues(texto) {
  const achadas = [];
  for (const bruta of String(texto ?? "").split(/\s+/)) {
    const palavra = semPontuacao(bruta);
    if (!palavra || /\d/.test(palavra) || /[.#:[\]()>=_/\\@{}*+$%-]/.test(palavra)) continue;
    if (ACENTO.test(palavra) || PALAVRAS_EM_PORTUGUES.has(palavra.toLowerCase())) achadas.push(palavra);
  }
  return achadas;
}

export function defeitoDeTexto(texto) {
  return DEFEITO.exec(String(texto ?? ""))?.[0] ?? null;
}

const ANTES_DE_REGEX = new Set(["(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^", ""]);
const PALAVRAS_ANTES_DE_REGEX = new Set(["return", "typeof", "case", "of", "in", "delete", "void", "throw", "new", "else", "do"]);

export function literaisDe(fonte) {
  const saida = [];
  let i = 0;

  function linhaDe(posicao) {
    return fonte.slice(0, posicao).split("\n").length;
  }

  function lerAspas(aspas) {
    const inicio = i;
    let texto = "";
    i++;
    while (i < fonte.length && fonte[i] !== aspas && fonte[i] !== "\n") {
      if (fonte[i] === "\\") {
        texto += fonte[i + 1] ?? "";
        i += 2;
      } else texto += fonte[i++];
    }
    i++;
    saida.push({ texto, linha: linhaDe(inicio) });
  }

  function lerRegex() {
    let classe = false;
    i++;
    while (i < fonte.length && fonte[i] !== "\n") {
      const c = fonte[i];
      if (c === "\\") i += 2;
      else {
        if (c === "[") classe = true;
        else if (c === "]") classe = false;
        else if (c === "/" && !classe) break;
        i++;
      }
    }
    i++;
    while (/[a-z]/i.test(fonte[i] ?? "")) i++;
  }

  function lerModelo() {
    let inicio = i;
    let texto = "";
    i++;
    while (i < fonte.length) {
      const c = fonte[i];
      if (c === "\\") {
        texto += fonte[i + 1] ?? "";
        i += 2;
      } else if (c === "`") {
        i++;
        break;
      } else if (c === "$" && fonte[i + 1] === "{") {
        saida.push({ texto, linha: linhaDe(inicio) });
        texto = "";
        i += 2;
        lerCodigo(true);
        inicio = i;
      } else texto += fonte[i++];
    }
    saida.push({ texto, linha: linhaDe(inicio) });
  }

  function lerCodigo(dentroDeModelo) {
    let profundidade = 0;
    let anterior = "";
    let palavraAnterior = "";
    while (i < fonte.length) {
      const c = fonte[i];
      if (/\s/.test(c)) {
        i++;
        continue;
      }
      if (c === "/" && fonte[i + 1] === "/") {
        while (i < fonte.length && fonte[i] !== "\n") i++;
        continue;
      }
      if (c === "/" && fonte[i + 1] === "*") {
        const fim = fonte.indexOf("*/", i + 2);
        i = fim < 0 ? fonte.length : fim + 2;
        continue;
      }
      if (c === '"' || c === "'") {
        lerAspas(c);
        anterior = '"';
        palavraAnterior = "";
        continue;
      }
      if (c === "`") {
        lerModelo();
        anterior = "`";
        palavraAnterior = "";
        continue;
      }
      if (c === "/") {
        if (ANTES_DE_REGEX.has(anterior) || PALAVRAS_ANTES_DE_REGEX.has(palavraAnterior)) {
          lerRegex();
          anterior = "/";
          palavraAnterior = "";
        } else {
          i++;
          anterior = "/";
          palavraAnterior = "";
        }
        continue;
      }
      if (/[A-Za-z_$]/.test(c)) {
        const inicio = i;
        while (/[\w$]/.test(fonte[i] ?? "")) i++;
        palavraAnterior = fonte.slice(inicio, i);
        anterior = "a";
        continue;
      }
      if (c === "{") profundidade++;
      if (c === "}") {
        if (dentroDeModelo && profundidade === 0) {
          i++;
          return;
        }
        profundidade--;
      }
      anterior = c;
      palavraAnterior = "";
      i++;
    }
  }

  lerCodigo(false);
  return saida;
}

export function textosEmPortuguesNaFonte(fonte) {
  const achados = [];
  for (const { texto, linha } of literaisDe(fonte)) {
    const limpo = texto.trim();
    if (!limpo) continue;
    const comAcento = ACENTO.test(limpo);
    const pareceRotulo = /^[A-ZÀ-Ö]/.test(limpo);
    const palavras = palavrasEmPortugues(limpo);
    if (comAcento || (pareceRotulo && palavras.length)) achados.push({ linha, texto: limpo.slice(0, 80), palavras });
  }
  return achados;
}
