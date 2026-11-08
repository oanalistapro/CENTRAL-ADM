
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

const auth = getAuth(getApp());
const db = getFirestore(getApp());

let autorizado = false;
let carregando = false;
let sessao = 0;

const $ = id => document.getElementById(id);

const escapeHTML = value =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function dataBR(value) {
  if (!value) return "—";

  let d;

  if (typeof value.toDate === "function") {
    d = value.toDate();
  } else if (typeof value.seconds === "number") {
    d = new Date(value.seconds * 1000);
  } else {
    d = new Date(value);
  }

  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR");
}

function criarInterface() {
  const nav = document.querySelector(".nav");
  const main = document.querySelector("main");

  if (!nav || !main || $("analistaCampeonatos")) return;

  const botoes = [
    ["analistaCampeonatos", "🏆 Campeonatos"],
    ["analistaSolicitacoes", "📋 Solicitações"]
  ];

  for (const [id, titulo] of botoes) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = titulo;
    botao.dataset.extraTab = id;
    nav.appendChild(botao);

    botao.addEventListener("click", () => {
      document.querySelectorAll(".nav button")
        .forEach(b => b.classList.remove("active"));

      botao.classList.add("active");

      document.querySelectorAll(".section")
        .forEach(s => s.classList.remove("active"));

      $(id).classList.add("active");

      $("pageTitle").textContent =
        id === "analistaCampeonatos"
          ? "Campeonatos"
          : "Solicitações";

      $("pageSubtitle").textContent =
        "Dados sincronizados do ANALISTA PRO.";

      window.scrollTo(0, 0);
    });
  }

  // Preserva a navegação original.
  document.querySelectorAll(".nav button[data-tab]")
    .forEach(botao => {
      botao.addEventListener("click", () => {
        document.querySelectorAll("[data-extra-tab]")
          .forEach(b => b.classList.remove("active"));
      });
    });

  const campeonato = document.createElement("section");
  campeonato.id = "analistaCampeonatos";
  campeonato.className = "section";

  campeonato.innerHTML = `
    <div class="card">
      <h2>🏆 Campeonatos do ANALISTA PRO</h2>
      <p class="muted">
        Campeonatos sincronizados do Firebase original.
        Consulta administrativa, sem alterar resultados.
      </p>

      <div class="toolbar">
        <input
          class="input"
          id="buscarCampeonato"
          placeholder="Pesquisar campeonato"
        >
        <button class="btn secondary"
          id="atualizarCampeonatos">
          ↻ Atualizar
        </button>
      </div>

      <div id="estadoCampeonatos" class="notice">
        Aguardando autenticação.
      </div>

      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Campeonato</th>
              <th>Tipo</th>
              <th>Responsável</th>
              <th>Publicado</th>
              <th>Sincronizado</th>
            </tr>
          </thead>
          <tbody id="tabelaCampeonatos"></tbody>
        </table>
      </div>
    </div>
  `;

  const solicitacoes = document.createElement("section");
  solicitacoes.id = "analistaSolicitacoes";
  solicitacoes.className = "section";

  solicitacoes.innerHTML = `
    <div class="card">
      <h2>📋 Solicitações do ANALISTA PRO</h2>
      <p class="muted">
        Acompanhamento das solicitações de liberação.
        A aprovação continua no aplicativo original.
      </p>

      <div class="toolbar">
        <input
          class="input"
          id="buscarSolicitacao"
          placeholder="Pesquisar UID ou status"
        >

        <select class="input" id="filtrarSolicitacao">
          <option value="">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="approved">Aprovado</option>
          <option value="rejected">Rejeitado</option>
        </select>

        <button class="btn secondary"
          id="atualizarSolicitacoes">
          ↻ Atualizar
        </button>
      </div>

      <div id="estadoSolicitacoes" class="notice">
        Aguardando autenticação.
      </div>

      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Status</th>
              <th>Solicitado em</th>
              <th>Revisado em</th>
            </tr>
          </thead>
          <tbody id="tabelaSolicitacoes"></tbody>
        </table>
      </div>
    </div>
  `;

  main.append(campeonato, solicitacoes);

  const resumo = document.createElement("div");
  resumo.className = "card";
  resumo.style.marginTop = "18px";
  resumo.innerHTML = `
    <h2>📡 Sincronização ANALISTA PRO</h2>
    <div class="grid">
      <div class="metric">
        <small>Usuários</small>
        <strong id="totalAnalistaUsuarios">—</strong>
      </div>
      <div class="metric">
        <small>Solicitações</small>
        <strong id="totalAnalistaSolicitacoes">—</strong>
      </div>
      <div class="metric">
        <small>Campeonatos</small>
        <strong id="totalAnalistaCampeonatos">—</strong>
      </div>
      <div class="metric">
        <small>Última sincronização</small>
        <strong id="ultimaSyncAnalista"
          style="font-size:15px">—</strong>
      </div>
    </div>
    <p class="muted small" id="estadoSyncAnalista">
      Aguardando consulta.
    </p>
  `;

  $("dashboard").appendChild(resumo);

  $("buscarCampeonato").addEventListener(
    "input", renderCampeonatos
  );

  $("buscarSolicitacao").addEventListener(
    "input", renderSolicitacoes
  );

  $("filtrarSolicitacao").addEventListener(
    "change", renderSolicitacoes
  );

  $("atualizarCampeonatos").onclick = carregar;
  $("atualizarSolicitacoes").onclick = carregar;

  $("refresh").addEventListener("click", carregar);
}

let campeonatos = [];
let solicitacoes = [];

function renderCampeonatos() {
  const termo = $("buscarCampeonato").value
    .toLowerCase().trim();

  const filtrados = campeonatos.filter(c =>
    [
      c.title,
      c.sourceId,
      c.sourceCollection,
      c.ownerUid
    ].join(" ").toLowerCase().includes(termo)
  );

  $("tabelaCampeonatos").innerHTML =
    filtrados.map(c => `
      <tr>
        <td>${escapeHTML(c.title || c.sourceId || "Sem título")}</td>
        <td>${escapeHTML(
          c.sourceCollection === "pontoCorrido"
            ? "Ponto corrido"
            : "Publicado"
        )}</td>
        <td><code>${escapeHTML(c.ownerUid || "—")}</code></td>
        <td>${c.published === true ? "Sim" : "Não"}</td>
        <td>${escapeHTML(dataBR(c.syncedAt))}</td>
      </tr>
    `).join("") || `
      <tr>
        <td colspan="5">Nenhum campeonato encontrado.</td>
      </tr>
    `;

  $("estadoCampeonatos").textContent =
    `${filtrados.length} de ${campeonatos.length} campeonatos.`;
}

function renderSolicitacoes() {
  const termo = $("buscarSolicitacao").value
    .toLowerCase().trim();

  const status = $("filtrarSolicitacao").value;

  const filtradas = solicitacoes.filter(s => {
    const pesquisa = [
      s.sourceUid,
      s.status
    ].join(" ").toLowerCase();

    return pesquisa.includes(termo) &&
      (!status || s.status === status);
  });

  const nomes = {
    pending: "Pendente",
    approved: "Aprovado",
    rejected: "Rejeitado"
  };

  $("tabelaSolicitacoes").innerHTML =
    filtradas.map(s => `
      <tr>
        <td><code>${escapeHTML(s.sourceUid || s.id)}</code></td>
        <td>
          <span class="pill ${
            s.status === "approved" ? "ok" :
            s.status === "pending" ? "warn" : "error"
          }">
            ${escapeHTML(nomes[s.status] || s.status || "—")}
          </span>
        </td>
        <td>${escapeHTML(dataBR(s.createdAt))}</td>
        <td>${escapeHTML(dataBR(s.reviewedAt))}</td>
      </tr>
    `).join("") || `
      <tr>
        <td colspan="4">Nenhuma solicitação encontrada.</td>
      </tr>
    `;

  $("estadoSolicitacoes").textContent =
    `${filtradas.length} de ${solicitacoes.length} solicitações.`;
}

async function carregar() {
  if (!autorizado || carregando) return;

  const tentativa = sessao;
  carregando = true;

  $("estadoSyncAnalista").textContent =
    "Consultando dados sincronizados...";

  try {
    const [cs, rs, resumo] = await Promise.all([
      getDocs(query(
        collection(db, "analistaChampionships"),
        limit(1000)
      )),
      getDocs(query(
        collection(db, "analistaRequests"),
        limit(1000)
      )),
      getDoc(doc(db, "settings", "analistaSync"))
    ]);

    if (tentativa !== sessao || !autorizado) return;

    campeonatos = cs.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    solicitacoes = rs.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    const info = resumo.exists() ? resumo.data() : {};

    $("totalAnalistaUsuarios").textContent =
      info.usersCount ?? "—";

    $("totalAnalistaSolicitacoes").textContent =
      solicitacoes.length;

    $("totalAnalistaCampeonatos").textContent =
      campeonatos.length;

    $("ultimaSyncAnalista").textContent =
      dataBR(info.lastSync);

    $("estadoSyncAnalista").textContent =
      "Dados consultados com sucesso. " +
      "A atualização depende do GitHub Actions.";

    renderCampeonatos();
    renderSolicitacoes();

    // Atualiza os indicadores de integração existentes.
    document.querySelectorAll(
      "#integrationOverview .project, " +
      "#settingsIntegrations .project"
    ).forEach(linha => {
      const nome = linha.querySelector(".projectBody b");
      if (nome?.textContent.trim() !== "ANALISTA PRO") return;

      const indicador = linha.querySelector(".pill");
      const descricao = linha.querySelector(".projectBody p");

      if (indicador) {
        indicador.textContent = "Sincronizado";
        indicador.className = "pill ok";
      }

      if (descricao) {
        descricao.textContent =
          "Usuários, solicitações e campeonatos sincronizados. " +
          "Última execução: " + dataBR(info.lastSync);
      }
    });

  } catch (erro) {
    console.error("Erro na sincronização:", erro);

    $("estadoSyncAnalista").textContent =
      "Erro ao consultar dados: " +
      (erro.code || erro.message);

    $("estadoCampeonatos").textContent =
      "Falha ao carregar campeonatos.";

    $("estadoSolicitacoes").textContent =
      "Falha ao carregar solicitações.";
  } finally {
    carregando = false;
  }
}

onAuthStateChanged(auth, async user => {
  const tentativa = ++sessao;

  autorizado = false;
  campeonatos = [];
  solicitacoes = [];

  if (!user) return;

  try {
    const snap = await getDoc(doc(db, "admins", user.uid));

    if (tentativa !== sessao) return;

    const dados = snap.exists() ? snap.data() : {};

    autorizado =
      dados.active === true ||
      dados.ative === true;

    if (autorizado) await carregar();

  } catch (erro) {
    console.error("Autorização do módulo:", erro);
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", criarInterface);
} else {
  criarInterface();
}
