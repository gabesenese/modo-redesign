import { criar, limitar } from "./utilitarios.js";

export function criarTopo(ctx) {
  const { host } = ctx;
  const persistentes = [];
  let pop = null;

  function erguer(elemento) {
    try {
      if (elemento.isConnected && !elemento.matches(":popover-open")) elemento.showPopover();
    } catch {}
  }

  function baixar(elemento) {
    try {
      if (elemento.matches(":popover-open")) elemento.hidePopover();
    } catch {}
  }

  function fixar(elemento) {
    persistentes.push(elemento);
    erguer(elemento);
  }

  function reerguer() {
    for (const elemento of persistentes) baixar(elemento);
    if (pop) baixar(pop.elemento);
    for (const elemento of persistentes) erguer(elemento);
    if (pop) erguer(pop.elemento);
  }

  function destinoCerto() {
    const modais = [...document.querySelectorAll("dialog")].filter((dialogo) => {
      try {
        return dialogo.matches(":modal");
      } catch {
        return false;
      }
    });
    return modais.at(-1) ?? document.documentElement;
  }

  function posicionarHost() {
    const destino = destinoCerto();
    if (host.parentNode !== destino || !host.isConnected) {
      destino.append(host);
      reerguer();
      ctx.emitir("hostMudou", destino);
    } else if (persistentes.some((elemento) => !elemento.matches(":popover-open"))) reerguer();
  }

  let agendado = false;
  function agendar() {
    if (agendado) return;
    agendado = true;
    queueMicrotask(() => {
      agendado = false;
      posicionarHost();
    });
  }

  new MutationObserver(agendar).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["open"],
  });

  function posicionarPop(elemento, ancora, lado) {
    const caixa = ancora.getBoundingClientRect();
    const largura = elemento.offsetWidth;
    const altura = elemento.offsetHeight;
    let x = lado === "esquerda" ? caixa.left - largura - 6 : caixa.left;
    let y = lado === "cima" ? caixa.top - altura - 6 : lado === "esquerda" ? caixa.top : caixa.bottom + 6;
    if (lado !== "cima" && y + altura > innerHeight - 8) y = caixa.top - altura - 6;
    if (y < 8) y = Math.min(innerHeight - altura - 8, caixa.bottom + 6);
    if (lado === "esquerda" && x < 8) x = caixa.right + 6;
    elemento.style.left = `${limitar(x, 8, Math.max(8, innerWidth - largura - 8))}px`;
    elemento.style.top = `${limitar(y, 8, Math.max(8, innerHeight - altura - 8))}px`;
  }

  function abrirPop(conteudo, ancora, opcoes = {}) {
    fecharPop();
    const elemento = criar(
      "div",
      { popover: "manual", classe: `pop ferramenta ${opcoes.classe ?? ""}`, role: opcoes.papel ?? "dialog", "aria-label": opcoes.rotulo },
      conteudo,
    );
    ctx.raiz.append(elemento);
    erguer(elemento);
    pop = { elemento, ancora, aoFechar: opcoes.aoFechar, foco: opcoes.focoDeVolta ?? ancora, lado: opcoes.lado };
    posicionarPop(elemento, ancora, opcoes.lado);
    if (opcoes.focar !== false) {
      const alvoDoFoco = elemento.querySelector("[data-foco], input, textarea, [role=option][aria-selected=true], button");
      alvoDoFoco?.focus({ preventScroll: true });
    }
    return elemento;
  }

  function fecharPop(devolverFoco = false) {
    if (!pop) return false;
    const atual = pop;
    pop = null;
    baixar(atual.elemento);
    atual.elemento.remove();
    atual.aoFechar?.();
    if (!devolverFoco) return true;
    const daBarra = atual.foco?.closest?.(".barra") && ctx.selecao?.atual;
    if (daBarra) ctx.selecao.focarSelecao();
    else if (atual.foco?.isConnected) atual.foco.focus({ preventScroll: true });
    return true;
  }

  function reposicionarPop() {
    if (pop && pop.ancora.isConnected) posicionarPop(pop.elemento, pop.ancora, pop.lado);
  }

  window.addEventListener(
    "pointerdown",
    (evento) => {
      if (!pop) return;
      const caminho = evento.composedPath();
      if (caminho.includes(pop.elemento) || caminho.includes(pop.ancora)) return;
      fecharPop();
    },
    true,
  );

  const dica = criar("div", { popover: "manual", classe: "dica-flutuante ferramenta", role: "tooltip" });
  ctx.raiz.append(dica);
  let temporizadorDaDica = 0;
  let alvoDaDica = null;
  let alvoPendente = null;
  let ultimoTab = -Infinity;

  function mostrarDica(alvo, imediato) {
    clearTimeout(temporizadorDaDica);
    alvoPendente = alvo;
    temporizadorDaDica = setTimeout(
      () => {
        alvoPendente = null;
        const texto = alvo.dataset.dica;
        if (!texto || !alvo.isConnected) return;
        dica.setAttribute("translate", alvo.closest('[translate="no"]') ? "no" : "yes");
        dica.replaceChildren(criar("span", { texto }));
        if (alvo.dataset.atalho) dica.append(criar("kbd", { texto: alvo.dataset.atalho }));
        baixar(dica);
        erguer(dica);
        const caixa = alvo.getBoundingClientRect();
        const largura = dica.offsetWidth;
        const altura = dica.offsetHeight;
        let y = caixa.bottom + 8;
        if (y + altura > innerHeight - 8) y = caixa.top - altura - 8;
        const x = limitar(caixa.left + caixa.width / 2 - largura / 2, 8, Math.max(8, innerWidth - largura - 8));
        dica.style.left = `${x}px`;
        dica.style.top = `${y}px`;
        alvoDaDica = alvo;
      },
      imediato ? 0 : 420,
    );
  }

  function esconderDica() {
    clearTimeout(temporizadorDaDica);
    baixar(dica);
    alvoDaDica = null;
    alvoPendente = null;
  }

  ctx.raiz.addEventListener("pointerover", (evento) => {
    const alvo = evento.target.closest?.("[data-dica]");
    if (!alvo) esconderDica();
    else if (alvo !== alvoDaDica && alvo !== alvoPendente) mostrarDica(alvo, Boolean(alvoDaDica));
  });
  ctx.raiz.addEventListener("pointerout", (evento) => {
    const destino = evento.relatedTarget;
    if (!(destino && ctx.raiz.contains(destino) && destino.closest("[data-dica]"))) esconderDica();
  });
  window.addEventListener(
    "pointermove",
    (evento) => {
      const alvo = alvoDaDica ?? alvoPendente;
      if (alvo && !evento.composedPath().includes(alvo)) esconderDica();
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    "keydown",
    (evento) => {
      if (evento.key === "Tab") ultimoTab = evento.timeStamp;
    },
    true,
  );
  ctx.raiz.addEventListener("pointerdown", esconderDica, true);
  ctx.raiz.addEventListener("keydown", esconderDica, true);
  ctx.raiz.addEventListener("focusin", (evento) => {
    const alvo = evento.target.closest?.("[data-dica]");
    const chegouPeloTab = evento.timeStamp - ultimoTab < 500;
    if (alvo && chegouPeloTab && evento.target.matches(":focus-visible")) mostrarDica(alvo, true);
  });
  ctx.raiz.addEventListener("focusout", esconderDica);

  return {
    fixar,
    reerguer,
    posicionarHost,
    abrirPop,
    fecharPop,
    reposicionarPop,
    popAberto: () => pop,
  };
}
