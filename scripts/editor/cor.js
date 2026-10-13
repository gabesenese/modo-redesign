let pincel = null;

function contexto() {
  if (!pincel) {
    const tela = document.createElement("canvas");
    tela.width = 1;
    tela.height = 1;
    pincel = tela.getContext("2d", { willReadFrequently: true });
  }
  return pincel;
}

export function resolverVariaveis(valor, elemento = document.documentElement, profundidade = 0) {
  const texto = String(valor ?? "");
  if (!texto.includes("var(") || profundidade > 8) return texto;
  const estilo = getComputedStyle(elemento);
  const trocado = texto.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (_inteiro, nome, reserva) => {
    const achado = estilo.getPropertyValue(nome).trim();
    return achado || (reserva ?? "").trim();
  });
  return resolverVariaveis(trocado, elemento, profundidade + 1);
}

export function rgbaDe(valor, elemento) {
  const resolvido = resolverVariaveis(valor, elemento).trim();
  if (!resolvido || !CSS.supports("color", resolvido)) return null;
  const ctx = contexto();
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#000";
  ctx.fillStyle = resolvido;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

export function hexDe(valor, elemento) {
  const rgba = rgbaDe(valor, elemento);
  if (!rgba) return null;
  return hexDeRgba(rgba);
}

export function hexDeRgba([r, g, b, a = 1]) {
  const base = "#" + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
  return a < 0.999 ? base + Math.round(a * 255).toString(16).padStart(2, "0") : base;
}

export function ehCor(valor, elemento) {
  return rgbaDe(valor, elemento) !== null;
}

function paraLinear(canal) {
  const c = canal / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function paraSrgb(canal) {
  const v = canal <= 0.0031308 ? 12.92 * canal : 1.055 * canal ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
}

export function oklchDeRgb([r, g, b]) {
  const lr = paraLinear(r);
  const lg = paraLinear(g);
  const lb = paraLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, Math.hypot(A, B), H];
}

function linearDeOklch(L, C, H) {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function cabe(linear) {
  return linear.every((v) => v >= -0.0001 && v <= 1.0001);
}

export function hexDeOklch(L, C, H) {
  let croma = C;
  if (!cabe(linearDeOklch(L, croma, H))) {
    let baixo = 0;
    let alto = croma;
    for (let i = 0; i < 24; i++) {
      const meio = (baixo + alto) / 2;
      if (cabe(linearDeOklch(L, meio, H))) baixo = meio;
      else alto = meio;
    }
    croma = baixo;
  }
  return hexDeRgba(linearDeOklch(L, croma, H).map(paraSrgb));
}

export function contraste(a, b) {
  const luz = ([r, g, bb]) => 0.2126 * paraLinear(r) + 0.7152 * paraLinear(g) + 0.0722 * paraLinear(bb);
  const [maior, menor] = [luz(a), luz(b)].sort((x, y) => y - x);
  return (maior + 0.05) / (menor + 0.05);
}
