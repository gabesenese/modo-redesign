import { contar, textoCurto } from "./utilitarios.js";

const ATRIBUTOS_DE_NOME = ["data-edit", "data-testid", "data-test", "data-cy", "data-component"];
const ID_INSTAVEL = /^(:|«|radix-|headlessui-|react-aria|mui-|_r_|r\d)|\d{4,}|^[a-f0-9]{8,}$/i;
const CLASSE_UTILITARIA =
  /[:[\]/!@]|^-?(m|p)[trblxyse]?-|^(flex|grid|block|inline|hidden|contents|items-|justify-|content-|self-|gap-|space-|w-|h-|size-|min-|max-|text-|font-|leading-|tracking-|bg-|border|rounded|shadow|opacity-|z-|top-|left-|right-|bottom-|inset-|overflow-|relative|absolute|fixed|sticky|static|col-|row-|order-|basis-|grow|shrink|transition|duration-|ease-|delay-|animate-|cursor-|select-|ring|outline|fill-|stroke-|object-|aspect-|sr-only|truncate|underline|italic|uppercase|lowercase|capitalize|whitespace-|break-|align-|place-|divide-|translate-|scale-|rotate-|skew-|origin-|backdrop-|blur|drop-shadow|from-|via-|to-|decoration-|list-|container$|group$|peer$)/;
const NOMES_DO_FRAMEWORK =
  /^(InnerLayoutRouter|OuterLayoutRouter|LayoutRouter|RenderFromTemplateContext|ScrollAndFocusHandler|InnerScrollAndFocusHandler|AppRouter|Router|HotReload|ReactDevOverlay|ServerRoot|Root|ClientPageRoot|ClientSegmentRoot|SegmentViewNode|SegmentStateProvider|SegmentBoundaryTriggerNode|HTTPAccessFallbackBoundary|HTTPAccessFallbackErrorBoundary|RedirectBoundary|RedirectErrorBoundary|NotFoundBoundary|LoadingBoundary|ErrorBoundary|ErrorBoundaryHandler|GlobalError|AppDevOverlay|DevRootHTTPAccessFallbackBoundary|MetadataBoundary|ViewportBoundary|OutletBoundary|Head|Suspense|Fragment|StrictMode|Profiler|Link|LinkComponent|Image|ImageElement|Script|__next_\w+)$/;
const VOCABULARIO_DE_TEMA = /^(dark|light|escuro|claro|dim|night|day|noite|dia|black|white)$/i;
const TAGS_SEM_CAIXA = new Set([
  "script",
  "style",
  "link",
  "meta",
  "noscript",
  "template",
  "head",
  "title",
  "base",
  "redesign-editor",
  "next-route-announcer",
  "nextjs-portal",
]);

export function ehIgnoravel(elemento) {
  return !elemento || elemento.nodeType !== 1 || TAGS_SEM_CAIXA.has(elemento.localName);
}

function classesUteis(elemento) {
  return [...elemento.classList].filter((classe) => !CLASSE_UTILITARIA.test(classe) && !classe.startsWith("__")).slice(0, 2);
}

function textoDeAtributo(valor) {
  return `"${String(valor).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function parteDe(elemento) {
  for (const nome of ATRIBUTOS_DE_NOME) {
    if (elemento.hasAttribute(nome)) return `[${nome}=${textoDeAtributo(elemento.getAttribute(nome))}]`;
  }
  if (elemento.id && !ID_INSTAVEL.test(elemento.id)) return `#${CSS.escape(elemento.id)}`;
  return elemento.localName + classesUteis(elemento).map((classe) => `.${CSS.escape(classe)}`).join("");
}

function temIdentidade(parte) {
  return /[.#[]/.test(parte);
}

export function seletorDoTipo(elemento) {
  if (elemento === document.documentElement) return ":root";
  if (elemento === document.body) return "body";
  let seletor = parteDe(elemento);
  if (seletor.startsWith("#") || seletor.startsWith("[")) return seletor;
  let ancestral = elemento.parentElement;
  let niveis = 0;
  while (ancestral && ancestral !== document.body && ancestral !== document.documentElement && niveis < 3) {
    const total = contar(seletor);
    const precisaDeContexto = !temIdentidade(seletor.split(" ").pop()) || total > 12;
    if (!precisaDeContexto && niveis > 0) break;
    if (!precisaDeContexto && temIdentidade(seletor)) break;
    const parte = parteDe(ancestral);
    if (temIdentidade(parte)) {
      const candidato = `${parte} ${seletor}`;
      if (contar(candidato) < total || !temIdentidade(seletor)) seletor = candidato;
      niveis++;
      if (parte.startsWith("#") || parte.startsWith("[")) break;
    }
    ancestral = ancestral.parentElement;
  }
  return seletor;
}

export function seletorDeste(elemento) {
  const base = seletorDoTipo(elemento);
  if (contar(base) === 1) return base;
  const partes = [];
  let atual = elemento;
  while (atual && atual !== document.documentElement) {
    let parte = parteDe(atual);
    const pai = atual.parentElement;
    if (pai && !parte.startsWith("#")) {
      const iguais = [...pai.children].filter((filho) => filho.localName === atual.localName);
      if (iguais.length > 1) parte += `:nth-of-type(${iguais.indexOf(atual) + 1})`;
    }
    partes.unshift(parte);
    const tentativa = partes.join(" > ");
    if (contar(tentativa) === 1) return tentativa;
    atual = pai;
  }
  return partes.join(" > ");
}

export function caminhoDe(elemento, limite = 5) {
  const partes = [];
  let atual = elemento;
  while (atual && atual !== document.documentElement && partes.length < limite) {
    partes.unshift(parteDe(atual));
    atual = atual.parentElement;
  }
  return partes.join(" > ");
}

function fibraDe(elemento) {
  for (const chave in elemento) {
    if (chave.startsWith("__reactFiber$") || chave.startsWith("__reactInternalInstance$")) return elemento[chave];
  }
  return null;
}

function nomeDoTipo(tipo) {
  if (!tipo) return null;
  if (typeof tipo === "function") return tipo.displayName || tipo.name || null;
  if (typeof tipo === "object") {
    return tipo.displayName || tipo.render?.displayName || tipo.render?.name || tipo.type?.displayName || tipo.type?.name || null;
  }
  return null;
}

function nomeUtil(nome) {
  if (NOMES_DO_FRAMEWORK.test(nome)) return false;
  if (/^(Anonymous|_c\d*|_default)$/.test(nome)) return false;
  if (/(Context|Provider|Consumer|Boundary|Router|Handler)\w{0,4}$/.test(nome)) return false;
  return !/^(Inner|Outer)[A-Z]/.test(nome);
}

export function componentesDe(elemento, limite = 4) {
  const nomes = [];
  let fibra = fibraDe(elemento);
  let passos = 0;
  while (fibra && nomes.length < limite && passos < 400) {
    const nome = nomeDoTipo(fibra.type);
    if (nome && nomeUtil(nome) && !nomes.includes(nome)) nomes.push(nome);
    for (const info of fibra._debugInfo ?? []) {
      const nomeDoServidor = info?.name;
      if (nomeDoServidor && nomeUtil(nomeDoServidor) && !nomes.includes(nomeDoServidor) && nomes.length < limite) {
        nomes.push(nomeDoServidor);
      }
    }
    fibra = fibra.return;
    passos++;
  }
  return nomes;
}

export function rotuloCurto(elemento) {
  if (elemento === document.documentElement) return "html";
  if (elemento === document.body) return "body";
  const nomeEditavel = elemento.getAttribute?.("data-edit");
  if (nomeEditavel) return nomeEditavel;
  const classes = classesUteis(elemento);
  return elemento.localName + (classes.length ? "." + classes[0] : elemento.id && !ID_INSTAVEL.test(elemento.id) ? "#" + elemento.id : "");
}

export function temTextoProprio(elemento) {
  if (!elemento) return false;
  for (const no of elemento.childNodes) {
    if (no.nodeType === 3 && no.textContent.trim()) return true;
  }
  return false;
}

export function descreverAlvo(elemento, alcance) {
  const seletor = alcance === "este" ? seletorDeste(elemento) : seletorDoTipo(elemento);
  return {
    seletor,
    alcance,
    quantos: contar(seletor),
    elemento: rotuloCurto(elemento),
    texto: textoCurto(elemento.innerText || elemento.textContent, 80),
    caminho: caminhoDe(elemento),
    componentes: componentesDe(elemento),
  };
}

export function marcaDeTema(config = {}) {
  const html = document.documentElement;
  const nomes = Array.isArray(config.tema)
    ? config.tema.filter((nome) => html.hasAttribute(nome))
    : [...html.attributes].filter((a) => a.name.startsWith("data-") && VOCABULARIO_DE_TEMA.test(a.value.trim())).map((a) => a.name);
  const partes = nomes.map((nome) => `[${nome}=${textoDeAtributo(html.getAttribute(nome))}]`);
  const classes = [...html.classList].filter((classe) => VOCABULARIO_DE_TEMA.test(classe)).map((classe) => `.${CSS.escape(classe)}`);
  const tudo = [...partes, ...classes];
  return tudo.length ? `html${tudo.join("")}` : null;
}

export function nomeDoTema(marca) {
  if (!marca) return null;
  const valores = [...marca.matchAll(/="([^"]+)"|\.([\w-]+)/g)].map((m) => m[1] ?? m[2]);
  return valores.join(" + ");
}

function pularIdentificador(texto, i) {
  while (i < texto.length) {
    const c = texto[i];
    if (c === "\\") i += 2;
    else if (/[\w-]/.test(c) || c.charCodeAt(0) > 127) i++;
    else break;
  }
  return i;
}

function fecharGrupo(texto, i, abre, fecha) {
  let nivel = 0;
  for (; i < texto.length; i++) {
    if (texto[i] === "\\") {
      i++;
      continue;
    }
    if (texto[i] === abre) nivel++;
    else if (texto[i] === fecha) {
      nivel--;
      if (nivel === 0) return i + 1;
    }
  }
  return texto.length;
}

function dividirLista(texto) {
  const partes = [];
  let nivel = 0;
  let inicio = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "(" || c === "[") nivel++;
    else if (c === ")" || c === "]") nivel--;
    else if (c === "," && nivel === 0) {
      partes.push(texto.slice(inicio, i).trim());
      inicio = i + 1;
    }
  }
  partes.push(texto.slice(inicio).trim());
  return partes.filter(Boolean);
}

function maiorDaLista(texto) {
  return dividirLista(texto).map(especificidadeDeUm).sort(compararEspecificidade).pop() ?? [0, 0, 0];
}

const PSEUDOELEMENTOS_ANTIGOS = new Set(["before", "after", "first-line", "first-letter"]);

function especificidadeDeUm(seletor) {
  let a = 0;
  let b = 0;
  let c = 0;
  let i = 0;
  while (i < seletor.length) {
    const ch = seletor[i];
    if (ch === "#") {
      a++;
      i = pularIdentificador(seletor, i + 1);
    } else if (ch === ".") {
      b++;
      i = pularIdentificador(seletor, i + 1);
    } else if (ch === "[") {
      b++;
      i = fecharGrupo(seletor, i, "[", "]");
    } else if (ch === ":") {
      if (seletor[i + 1] === ":") {
        c++;
        i = pularIdentificador(seletor, i + 2);
        if (seletor[i] === "(") i = fecharGrupo(seletor, i, "(", ")");
        continue;
      }
      const inicio = i + 1;
      i = pularIdentificador(seletor, inicio);
      const nome = seletor.slice(inicio, i).toLowerCase();
      if (seletor[i] === "(") {
        const fim = fecharGrupo(seletor, i, "(", ")");
        const dentro = seletor.slice(i + 1, fim - 1);
        if (["is", "not", "has", "matches", "-webkit-any"].includes(nome)) {
          const [x, y, z] = maiorDaLista(dentro);
          a += x;
          b += y;
          c += z;
        } else if (nome === "nth-child" || nome === "nth-last-child") {
          b++;
          const partes = dentro.split(/\s+of\s+/i);
          if (partes[1]) {
            const [x, y, z] = maiorDaLista(partes[1]);
            a += x;
            b += y;
            c += z;
          }
        } else if (nome !== "where") b++;
        i = fim;
      } else if (PSEUDOELEMENTOS_ANTIGOS.has(nome)) c++;
      else b++;
    } else if (/[a-zA-Z_]/.test(ch) || ch.charCodeAt(0) > 127 || ch === "\\") {
      c++;
      i = pularIdentificador(seletor, i);
    } else i++;
  }
  return [a, b, c];
}

function compararEspecificidade(x, y) {
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

export function especificidade(seletorTexto, elemento) {
  const casam = dividirLista(seletorTexto).filter((um) => {
    try {
      return elemento.matches(um);
    } catch {
      return false;
    }
  });
  return (casam.length ? casam : dividirLista(seletorTexto)).map(especificidadeDeUm).sort(compararEspecificidade).pop() ?? [0, 0, 0];
}

const textosDasFolhas = new Map();

function marcasDoTexto(texto) {
  const marcas = [];
  const padroes = [/\/\*\s*\[project\]\/(\S+?)\s+\[[^\]]*\]\s*\(css\)\s*\*\//g, /\/\*!\*+!\*\\?\s*!\*\*\*\s*css\s+(\S+?)\s/g];
  for (const padrao of padroes) {
    for (const m of texto.matchAll(padrao)) marcas.push({ posicao: m.index, arquivo: m[1].replace(/^\.\//, "") });
  }
  return marcas.sort((x, y) => x.posicao - y.posicao);
}

export function prepararOrigens() {
  for (const folha of document.styleSheets) {
    const href = folha.href;
    if (!href || textosDasFolhas.has(href)) continue;
    let mesmaOrigem = false;
    try {
      mesmaOrigem = new URL(href).origin === location.origin;
    } catch {}
    if (!mesmaOrigem) continue;
    textosDasFolhas.set(href, null);
    fetch(href)
      .then((resposta) => (resposta.ok ? resposta.text() : ""))
      .then((texto) => textosDasFolhas.set(href, { texto, marcas: marcasDoTexto(texto) }))
      .catch(() => {});
  }
}

function arquivosDaRegra(regra) {
  const folha = regra.parentStyleSheet;
  const dono = folha?.ownerNode;
  if (dono?.dataset?.viteDevId) return [dono.dataset.viteDevId];
  const dados = folha?.href ? textosDasFolhas.get(folha.href) : null;
  if (dados?.marcas?.length && regra.selectorText) {
    const achados = new Set();
    const procurado = `${regra.selectorText} {`;
    let posicao = dados.texto.indexOf(procurado);
    while (posicao >= 0 && achados.size < 4) {
      const marca = [...dados.marcas].reverse().find((item) => item.posicao < posicao);
      if (marca) achados.add(marca.arquivo);
      posicao = dados.texto.indexOf(procurado, posicao + procurado.length);
    }
    if (achados.size) return [...achados];
  }
  if (folha?.href) {
    try {
      return [decodeURIComponent(new URL(folha.href).pathname)];
    } catch {
      return [folha.href];
    }
  }
  if (dono?.localName === "style") return ["page <style>"];
  return ["?"];
}

let cacheDeRegras = null;
let chaveDoCache = "";
const folhasDoEditor = new Set();

export function registrarFolhaDoEditor(folha) {
  folhasDoEditor.add(folha);
}

function chaveDasFolhas() {
  let chave = "";
  for (const folha of document.styleSheets) {
    try {
      chave += `${folha.href ?? "i"}:${folha.cssRules.length};`;
    } catch {
      chave += "x;";
    }
  }
  return chave + document.adoptedStyleSheets.length;
}

function* percorrer(regras, contexto) {
  for (const regra of regras) {
    if (regra instanceof CSSStyleRule) {
      yield { regra, ...contexto };
    } else if (regra instanceof CSSMediaRule) {
      const condicao = regra.conditionText ?? regra.media.mediaText;
      yield* percorrer(regra.cssRules, { ...contexto, media: [...contexto.media, condicao], mediaAtiva: contexto.mediaAtiva && matchMedia(condicao).matches });
    } else if (regra instanceof CSSSupportsRule) {
      if (CSS.supports(regra.conditionText)) yield* percorrer(regra.cssRules, contexto);
    } else if (typeof CSSLayerBlockRule !== "undefined" && regra instanceof CSSLayerBlockRule) {
      yield* percorrer(regra.cssRules, { ...contexto, camada: regra.name || "(anonymous)" });
    } else if (typeof CSSContainerRule !== "undefined" && regra instanceof CSSContainerRule) {
      yield* percorrer(regra.cssRules, { ...contexto, container: regra.conditionText });
    } else if (regra instanceof CSSImportRule && regra.styleSheet) {
      try {
        yield* percorrer(regra.styleSheet.cssRules, contexto);
      } catch {}
    }
  }
}

function todasAsRegras() {
  const chave = chaveDasFolhas();
  if (cacheDeRegras && chave === chaveDoCache) return cacheDeRegras;
  const lista = [];
  const folhas = [...document.styleSheets, ...document.adoptedStyleSheets.filter((folha) => !folhasDoEditor.has(folha))];
  for (const folha of folhas) {
    let regras;
    try {
      regras = folha.cssRules;
    } catch {
      continue;
    }
    for (const item of percorrer(regras, { media: [], mediaAtiva: true, camada: null, container: null })) {
      item.ordem = lista.length;
      lista.push(item);
    }
  }
  cacheDeRegras = lista;
  chaveDoCache = chave;
  return lista;
}

export function regrasQueCasam(elemento) {
  const saida = [];
  for (const item of todasAsRegras()) {
    if (!item.mediaAtiva) continue;
    let casa = false;
    try {
      casa = elemento.matches(item.regra.selectorText);
    } catch {}
    if (casa) saida.push(item);
  }
  return saida;
}

function precede(x, y) {
  if (x.importante !== y.importante) return x.importante ? -1 : 1;
  if (x.inline !== y.inline) return x.inline ? -1 : 1;
  const xCamada = x.camada !== null;
  const yCamada = y.camada !== null;
  if (xCamada !== yCamada) return x.importante ? (xCamada ? -1 : 1) : xCamada ? 1 : -1;
  return compararEspecificidade(y.especificidade, x.especificidade) || y.ordem - x.ordem;
}

export function regrasDaPropriedade(elemento, propriedade, casadas = regrasQueCasam(elemento)) {
  const lista = [];
  for (const item of casadas) {
    const valor = item.regra.style.getPropertyValue(propriedade);
    if (!valor) continue;
    lista.push({
      seletor: item.regra.selectorText,
      valor: valor.trim(),
      importante: item.regra.style.getPropertyPriority(propriedade) === "important",
      origem: arquivosDaRegra(item.regra).join(" or "),
      media: item.media.length ? item.media.join(" and ") : null,
      camada: item.camada,
      container: item.container,
      especificidade: especificidade(item.regra.selectorText, elemento),
      ordem: item.ordem,
      inline: false,
    });
  }
  const inline = elemento.style?.getPropertyValue(propriedade);
  if (inline) {
    lista.push({
      seletor: 'style=""',
      valor: inline.trim(),
      importante: elemento.style.getPropertyPriority(propriedade) === "important",
      origem: "element style attribute",
      media: null,
      camada: null,
      container: null,
      especificidade: [1, 0, 0, 0],
      ordem: Infinity,
      inline: true,
    });
  }
  lista.sort(precede);
  return lista.map((item, indice) => ({
    seletor: item.seletor,
    valor: item.valor,
    origem: item.origem,
    media: item.media,
    camada: item.camada,
    container: item.container,
    importante: item.importante || undefined,
    vence: indice === 0 || undefined,
  }));
}

export function regrasDoElemento(elemento) {
  return regrasQueCasam(elemento).map((item) => ({
    seletor: item.regra.selectorText,
    origem: arquivosDaRegra(item.regra).join(" or "),
    media: item.media.length ? item.media.join(" and ") : null,
    camada: item.camada,
    declaracoes: item.regra.style.cssText,
  }));
}

export function seletoresQueDeclaram(nome) {
  const achados = new Set();
  for (const item of todasAsRegras()) {
    if (!item.mediaAtiva || !item.regra.style.getPropertyValue(nome)) continue;
    let presente = false;
    try {
      presente = document.querySelector(item.regra.selectorText) !== null;
    } catch {}
    if (presente) achados.add(item.regra.selectorText);
  }
  return [...achados];
}

export function nomesDeTokens() {
  const nomes = new Set();
  for (const item of todasAsRegras()) {
    const seletor = item.regra.selectorText ?? "";
    if (!/(^|,)\s*(:root|html|body|\[data-|\.dark|\.light)/.test(seletor)) continue;
    const estilo = item.regra.style;
    for (let i = 0; i < estilo.length; i++) {
      if (estilo[i].startsWith("--")) nomes.add(estilo[i]);
    }
  }
  return [...nomes];
}
