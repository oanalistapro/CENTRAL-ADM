
import { getApp } from
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  limit
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);

let autorizado = false;
let campeonatos = [];
let solicitacoes = [];
let sessao = 0;

const $ = id => document.getElementById(id);

function el(tag, value, classe) {
  const e = document.createElement(tag);
  if (value !== undefined) e.textContent = String(value);
  if (classe) e.className = classe;
  return e;
}

function dataBR(v) {
  if (!v) return "—";

  const d = typeof v.toDate === "function"
    ? v.toDate()
    : new Date(v);

  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR");
}

function abrirDetalhes(titulo, linhas, equipes = []) {
  const anterior = $("modalCentralDetalhes");
  if (anterior) anterior.remove();

  const fundo = el("div");
  fundo.id = "modalCentralDetalhes";

  Object.assign(fundo.style, {
    position: "fixed",
    inset: "0",
    background: "#000b",
    zIndex: "3000",
    display: "grid",
    placeItems: "center",
    padding: "15px"
  });

  const painel = el("div", undefined, "card");

  Object.assign(painel.style, {
    width: "min(720px,100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#172740",
    borderRadius: "18px"
  });

  const cabecalho = el("div");
  Object.assign(cabecalho.style, {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px"
  });

  cabecalho.append(el("h2", titulo));

  const fechar = el("button", "✕ Fechar", "btn secondary");
  fechar.onclick = () => fundo.remove();

  cabecalho.append(fechar);
  painel.append(cabecalho);

  for (const [nome, valor] of linhas) {
    const p = el("p");
    const b = el("b", nome + ": ");
    p.append(b, document.createTextNode(String(valor ?? "—")));
    painel.append(p);
  }

  if (equipes.length) {
    painel.append(el("h2", "Equipes e pontuação"));

    const tabela = el("table");
    const cab = el("tr");

    ["Equipe", "Posição", "Pontos", "Kills"]
      .forEach(x => cab.append(el("th", x)));

    tabela.append(cab);

    equipes.forEach(e => {
      const tr = el("tr");

      [
        e.nome,
        e.posicao,
        e.pontos,
        e.kills
      ].forEach(x => tr.append(el("td", x ?? "—")));

      tabela.append(tr);
    });

    const area = el("div", undefined, "tablewrap");
    area.append(tabela);
    painel.append(area);
  } else if (titulo.startsWith("Campeonato")) {
    painel.append(el(
      "p",
      "Nenhuma equipe encontrada nos campos sincronizados.",
      "muted"
    ));
  }

  fundo.append(painel);

  fundo.addEventListener("click", evento => {
    if (evento.target === fundo) fundo.remove();
  });

  document.body.append(fundo);
}

function renderizarBotoes() {
  if (!autorizado) return;

  const tabelaCamp = $("tabelaCampeonatos");
  const tabelaReq = $("tabelaSolicitacoes");

  if (tabelaCamp) {
    const linhas = tabelaCamp.querySelectorAll("tr");

    linhas.forEach((tr, indice) => {
      const nome = tr.cells[0]?.textContent?.trim();

      if (!nome || nome.includes("Nenhum campeonato")) return;
      if (tr.querySelector(".detalhesCamp")) return;

      const campeonato = campeonatos.find(c =>
        (c.title || c.sourceId || "Sem título") === nome
      );

      if (!campeonato) return;

      const td = el("td");
      const botao = el("button", "Ver detalhes", "btn secondary");
      botao.classList.add("detalhesCamp");

      botao.onclick = () => abrirDetalhes(
        "Campeonato: " + (campeonato.title || campeonato.sourceId),
        [
          ["ID", campeonato.sourceId],
          ["Tipo", campeonato.sourceCollection],
          ["Responsável", campeonato.ownerUid],
          ["Status", campeonato.status || "—"],
          ["Publicado", campeonato.published ? "Sim" : "Não"],
          ["Equipes", campeonato.teamCount ?? 0],
          ["Sincronizado", dataBR(campeonato.syncedAt)]
        ],
        campeonato.teams || []
      );

      td.append(botao);
      tr.append(td);
    });
  }

  if (tabelaReq) {
    const linhas = tabelaReq.querySelectorAll("tr");

    linhas.forEach(tr => {
      const uid = tr.cells[0]?.textContent?.trim();

      if (!uid || uid.includes("Nenhuma solicitação")) return;
      if (tr.querySelector(".detalhesReq")) return;

      const pedido = solicitacoes.find(s =>
        (s.sourceUid || s.id) === uid
      );

      if (!pedido) return;

      const td = el("td");
      const botao = el("button", "Ver detalhes", "btn secondary");
      botao.classList.add("detalhesReq");

      botao.onclick = () => abrirDetalhes(
        "Solicitação de campeonato",
        [
          ["Usuário UID", pedido.sourceUid],
          ["Status", pedido.status],
          ["Solicitado em", dataBR(pedido.createdAt)],
          ["Revisado em", dataBR(pedido.reviewedAt)],
          ["Revisado por", pedido.reviewedBy || "—"]
        ]
      );

      td.append(botao);
      tr.append(td);
    });
  }
}

async function carregar() {
  if (!autorizado) return;

  const tentativa = sessao;

  try {
    const [c, s] = await Promise.all([
      getDocs(query(
        collection(db, "analistaChampionships"),
        limit(1000)
      )),
      getDocs(query(
        collection(db, "analistaRequests"),
        limit(1000)
      ))
    ]);

    if (tentativa !== sessao || !autorizado) return;

    campeonatos = c.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    solicitacoes = s.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    renderizarBotoes();

  } catch (erro) {
    console.error("Erro ao carregar detalhes:", erro);
  }
}

function iniciar() {
  const alvo = document.querySelector("main");
  if (!alvo) return;

  // Observa as tabelas existentes para acrescentar
  // os botões após filtros e atualizações.
  const observer = new MutationObserver(() => {
    renderizarBotoes();
  });

  ["tabelaCampeonatos", "tabelaSolicitacoes"].forEach(id => {
    const tabela = $(id);
    if (tabela) {
      observer.observe(tabela, {
        childList: true
      });
    }
  });

  document.querySelectorAll(
    "#atualizarCampeonatos, #atualizarSolicitacoes"
  ).forEach(b => {
    b.addEventListener("click", () => {
      setTimeout(carregar, 500);
    });
  });

  onAuthStateChanged(auth, async user => {
    const tentativa = ++sessao;

    autorizado = false;
    campeonatos = [];
    solicitacoes = [];

    if (!user) return;

    try {
      const snap = await getDoc(
        doc(db, "admins", user.uid)
      );

      if (tentativa !== sessao) return;

      const dados = snap.exists() ? snap.data() : {};

      autorizado =
        dados.active === true ||
        dados.ative === true;

      if (autorizado) await carregar();

    } catch (erro) {
      console.error("Erro de autorização:", erro);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar);
} else {
  iniciar();
}
