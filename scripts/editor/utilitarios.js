export const BASE = "/__redesign/";

export function criar(tag, atributos = {}, ...filhos) {
  const elemento = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (nome === "classe") elemento.className = valor;
    else if (nome === "texto") elemento.textContent = valor;
    else if (nome === "on") for (const [evento, funcao] of Object.entries(valor)) elemento.addEventListener(evento, funcao);
    else if (nome === "estilo") {
      for (const [chave, item] of Object.entries(valor)) {
        if (chave.startsWith("--")) elemento.style.setProperty(chave, item);
        else elemento.style[chave] = item;
      }
    } else if (nome === "dados") for (const [chave, item] of Object.entries(valor)) elemento.dataset[chave] = item;
    else elemento.setAttribute(nome, valor === true ? "" : String(valor));
  }
  for (const filho of filhos.flat(Infinity)) {
    if (filho === null || filho === undefined || filho === false) continue;
    elemento.append(filho instanceof Node ? filho : String(filho));
  }
  return elemento;
}

export function criarBarramento() {
  const ouvintes = new Map();
  return {
    ouvir(nome, funcao) {
      if (!ouvintes.has(nome)) ouvintes.set(nome, new Set());
      ouvintes.get(nome).add(funcao);
      return () => ouvintes.get(nome)?.delete(funcao);
    },
    emitir(nome, dados) {
      for (const funcao of [...(ouvintes.get(nome) ?? [])]) {
        try {
          funcao(dados);
        } catch (erro) {
          console.error("[redesign mode]", nome, erro);
        }
      }
    },
  };
}

export function lerPreferencia(chave, padrao) {
  try {
    const bruto = localStorage.getItem(`modo-redesign:${chave}`);
    return bruto === null ? padrao : JSON.parse(bruto);
  } catch {
    return padrao;
  }
}

export function gravarPreferencia(chave, valor) {
  try {
    localStorage.setItem(`modo-redesign:${chave}`, JSON.stringify(valor));
  } catch {}
}

export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

export function limitar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}

export function novoId() {
  return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function contar(seletor) {
  try {
    return document.querySelectorAll(seletor).length;
  } catch {
    return 0;
  }
}

export function todos(seletor) {
  try {
    return [...document.querySelectorAll(seletor)];
  } catch {
    return [];
  }
}

export function primeiro(seletor) {
  try {
    return document.querySelector(seletor);
  } catch {
    return null;
  }
}

export function textoCurto(texto, tamanho = 80) {
  const limpo = String(texto ?? "").replace(/\s+/g, " ").trim();
  return limpo.length > tamanho ? limpo.slice(0, tamanho - 1) + "…" : limpo;
}

export function ehCampoDeTexto(no) {
  if (!no || no.nodeType !== 1) return false;
  if (no.isContentEditable) return true;
  if (no.localName === "textarea") return true;
  if (no.localName !== "input") return false;
  return !["button", "checkbox", "radio", "range", "color", "submit", "reset", "file", "image", "hidden"].includes(no.type);
}

export function valorSeguro(valor) {
  return String(valor ?? "").replace(/[{};]/g, "").trim();
}

export function propriedadeSegura(nome) {
  return /^-{0,2}[a-zA-Z][a-zA-Z0-9-]*$/.test(String(nome ?? ""));
}
