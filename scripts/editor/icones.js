const CAMINHOS = {
  cursor: '<path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/>',
  negrito: '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>',
  italico: '<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>',
  sublinhado: '<path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  lista: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  esquerda: '<path d="M15 12H3"/><path d="M17 18H3"/><path d="M21 6H3"/>',
  centro: '<path d="M17 12H7"/><path d="M19 18H5"/><path d="M21 6H3"/>',
  direita: '<path d="M21 12H9"/><path d="M21 18H7"/><path d="M21 6H3"/>',
  justificado: '<path d="M3 12h18"/><path d="M3 18h18"/><path d="M3 6h18"/>',
  comentario: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  mais: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  fechar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  camadas:
    '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  painel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
  paleta:
    '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z"/>',
  fonte: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>',
  mudancas:
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  enviar: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  desfazer: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  refazer: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>',
  lixo: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  copiar:
    '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  oculto:
    '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
  baixo: '<path d="m6 9 6 6 6-6"/>',
  lado: '<path d="m9 18 6-6-6-6"/>',
  pai: '<polyline points="14 9 9 4 4 9"/><path d="M20 20h-7a4 4 0 0 1-4-4V4"/>',
  balde:
    '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>',
  raio: '<path d="M21 11a8 8 0 0 0-8-8"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
  preenchimento: '<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  certo: '<path d="M20 6 9 17l-5-5"/>',
  alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  texto:
    '<path d="M5 4h1a3 3 0 0 1 3 3 3 3 0 0 1 3-3h1"/><path d="M13 20h-1a3 3 0 0 1-3-3 3 3 0 0 1-3 3H5"/><path d="M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1"/><path d="M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7"/><path d="M9 7v10"/>',
  ajustar:
    '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
  setaDireita: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  setaBaixo: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  setaEsquerda: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  setaCima: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  alvo: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  elo: '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>',
  olho: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  bloco: '<rect x="4" y="4" width="16" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="16" height="6.5" rx="1.5"/>',
  pilha: '<rect x="3.5" y="5" width="4.5" height="14" rx="1.5"/><rect x="9.75" y="5" width="4.5" height="14" rx="1.5"/><rect x="16" y="5" width="4.5" height="14" rx="1.5"/>',
  grade: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  naLinha: '<path d="M3 12h3.5"/><rect x="8.5" y="7.5" width="7" height="9" rx="1.5"/><path d="M17.5 12H21"/>',
  fixa: '<path d="M4 6v12"/><path d="M20 6v12"/><path d="M8 12h8"/>',
  abracar: '<path d="M8 5 4.5 12 8 19"/><path d="m16 5 3.5 7-3.5 7"/><path d="M10.5 12h3"/>',
  preencher: '<path d="M4 12h16"/><path d="m7 9-3 3 3 3"/><path d="m17 9 3 3-3 3"/>',
  quadro: '<path d="M7.5 3v18"/><path d="M16.5 3v18"/><path d="M3 7.5h18"/><path d="M3 16.5h18"/>',
  letra: '<path d="M5 7V5h14v2"/><path d="M12 5v14"/><path d="M9 19h6"/>',
  imagem: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  botao: '<rect x="3" y="7" width="18" height="10" rx="5"/><path d="M9 12h6"/>',
  vetor: '<path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="m4 7 8 4 8-4"/><path d="M12 11v10"/>',
  campoDeTexto: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4"/>',
  secao: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>',
  rotacao: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
  escala: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/>',
  opacidade: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
  espaco: '<path d="M6 4v16"/><path d="M18 4v16"/><path d="M10 12h4"/>',
  margem: '<rect x="7.5" y="7.5" width="9" height="9" rx="1"/><path d="M3 3h18v18H3z" stroke-dasharray="2.5 2.5"/>',
  linha: '<path d="M4 5h16"/><path d="M4 19h16"/><path d="M12 8v8"/><path d="m9.5 10.5 2.5-2.5 2.5 2.5"/><path d="m9.5 13.5 2.5 2.5 2.5-2.5"/>',
  letras: '<path d="M8 16 11 8l3 8"/><path d="M9 13.5h4"/><path d="M3 5v14"/><path d="M21 5v14"/>',
  token: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
  borda: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
  sombra: '<rect x="3" y="3" width="13" height="13" rx="2.5"/><path d="M20 8v10a2 2 0 0 1-2 2H8"/>',
  posicao: '<path d="M12 3v18"/><path d="M3 12h18"/><circle cx="12" cy="12" r="3.5"/>',
  camadaZ: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  marca: '<path d="M20 6 9 17l-5-5"/>',
  maiusculas: '<path d="M3 18 7 6l4 12"/><path d="M4.4 14h5.2"/><path d="M14 18V6h4a3 3 0 0 1 0 6h-4"/><path d="M14 12h4.5a3 3 0 0 1 0 6H14"/>',
};

export function icone(nome, tamanho = 16) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(tamanho));
  svg.setAttribute("height", String(tamanho));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = CAMINHOS[nome] ?? CAMINHOS.mais;
  return svg;
}
