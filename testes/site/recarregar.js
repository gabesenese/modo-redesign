const protocolo = location.protocol === "https:" ? "wss" : "ws";
const canal = new WebSocket(`${protocolo}://${location.host}/__site/recarregar`);

canal.addEventListener("message", (evento) => {
  if (evento.data !== "css") return;
  for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
    const url = new URL(link.href);
    url.searchParams.set("v", String(Date.now()));
    const novo = link.cloneNode();
    novo.href = url.href;
    novo.addEventListener("load", () => link.remove());
    link.after(novo);
  }
});

window.__recarregamento = { canal };
