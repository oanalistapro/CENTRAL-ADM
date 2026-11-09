
import { getApp } from
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);

const projetos = [
  {
    id: "analista",
    nome: "ANALISTA PRO",
    documento: "analistaSync"
  },
  {
    id: "business",
    nome: "BUSINESS PRO",
    documento: "businessSync"
  },
  {
    id: "gaming",
    nome: "GAMING PRO",
    documento: "gamingSync"
  }
];

let sessao = 0;
let autorizado = false;

const estados = new Map();

function atualizarProjeto(projeto, dados) {
  const conectado = dados?.status === "connected";

  estados.set(projeto.id, conectado);

  document.querySelectorAll(
    "#projectsList .project, " +
    "#integrationOverview .project, " +
    "#settingsIntegrations .project"
  ).forEach(linha => {
    const nome = linha.querySelector(".projectBody b");

    if (nome?.textContent.trim() !== projeto.nome) {
      return;
    }

    const indicador = linha.querySelector(".pill");

    if (indicador) {
      indicador.textContent = conectado
        ? "Sincronizado"
        : "Pendente";

      indicador.className = conectado
        ? "pill ok"
        : "pill warn";
    }

    // Preserva a descrição e o botão Abrir portal
    // da seção Projetos.
    if (linha.closest("#projectsList")) return;

    const descricao = linha.querySelector(".projectBody p");

    if (descricao) {
      if (conectado) {
        const total = Number.isFinite(dados.usersCount)
          ? `${dados.usersCount} usuário(s). `
          : "";

        descricao.textContent =
          total + "Sincronização administrativa confirmada.";
      } else {
        descricao.textContent =
          "Aguardando sincronização de dados.";
      }
    }
  });
}

function aplicarEstados() {
  for (const projeto of projetos) {
    if (!estados.has(projeto.id)) continue;

    atualizarProjeto(projeto, {
      status: estados.get(projeto.id)
        ? "connected"
        : "pending"
    });
  }
}

async function consultar() {
  if (!autorizado || !auth.currentUser) return;

  const tentativa = sessao;

  for (const projeto of projetos) {
    try {
      const snap = await getDoc(
        doc(db, "settings", projeto.documento)
      );

      if (tentativa !== sessao || !autorizado) return;

      atualizarProjeto(
        projeto,
        snap.exists() ? snap.data() : null
      );

    } catch (erro) {
      console.error(
        "Erro ao consultar " + projeto.nome,
        erro
      );
    }
  }
}

onAuthStateChanged(auth, async usuario => {
  const tentativa = ++sessao;

  autorizado = false;
  estados.clear();

  if (!usuario) return;

  try {
    const snap = await getDoc(
      doc(db, "admins", usuario.uid)
    );

    if (tentativa !== sessao) return;

    const dados = snap.exists() ? snap.data() : {};

    autorizado =
      dados.active === true ||
      dados.ative === true;

    if (autorizado) await consultar();

  } catch (erro) {
    console.error("Erro de autorização:", erro);
  }
});

// Atualiza os indicadores se o painel
// reconstruir os elementos da página.
const observador = new MutationObserver(() => {
  if (autorizado) aplicarEstados();
});

function iniciar() {
  [
    "projectsList",
    "integrationOverview",
    "settingsIntegrations"
  ].forEach(id => {
    const elemento = document.getElementById(id);

    if (elemento) {
      observador.observe(elemento, {
        childList: true
      });
    }
  });

  document.getElementById("refresh")
    ?.addEventListener("click", () => {
      consultar().catch(console.error);
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar);
} else {
  iniciar();
}
