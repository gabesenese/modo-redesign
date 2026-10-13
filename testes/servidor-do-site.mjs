#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const argumentos = process.argv.slice(2);
const valorDe = (nome, padrao) => {
  const i = argumentos.indexOf(`--${nome}`);
  return i >= 0 ? argumentos[i + 1] : padrao;
};
const pasta = path.resolve(valorDe("pasta", path.join(path.dirname(fileURLToPath(import.meta.url)), "site")));
const porta = Number(valorDe("porta", 4400));
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const canais = new Set();

function quadroDeTexto(texto) {
  const dados = Buffer.from(texto);
  return Buffer.concat([Buffer.from([0x81, dados.length]), dados]);
}

const servidor = http.createServer((req, res) => {
  const caminho = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (req.method === "POST" && caminho === "/enviado") {
    req.resume();
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end("<!doctype html><title>Enviado</title><p>Formulário enviado.</p>");
  }
  const nome = caminho === "/" ? "index.html" : caminho.replace(/^\/+/, "");
  if (!/^[\w.-]+$/.test(nome)) {
    res.writeHead(404);
    return res.end();
  }
  fs.readFile(path.join(pasta, nome), (erro, dados) => {
    if (erro) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      return res.end("não existe");
    }
    res.writeHead(200, { "content-type": TIPOS[path.extname(nome)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(dados);
  });
});

servidor.on("upgrade", (req, socket) => {
  if (!(req.url ?? "").startsWith("/__site/recarregar")) return socket.destroy();
  const chave = req.headers["sec-websocket-key"];
  const aceite = crypto.createHash("sha1").update(`${chave}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${aceite}\r\n\r\n`);
  canais.add(socket);
  socket.on("data", () => {});
  socket.on("close", () => canais.delete(socket));
  socket.on("error", () => canais.delete(socket));
});

let temporizador = null;
fs.watch(path.join(pasta, "estilo.css"), () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    for (const socket of canais) socket.write(quadroDeTexto("css"));
  }, 60);
});

servidor.listen(porta, "127.0.0.1", () => console.log(`site de prova em http://localhost:${porta}, servindo ${pasta}`));
