
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

const projetos = {
  business: {
    nome: "BUSINESS PRO",
    descricao: "Aguardando sincronização de dados."
  },
  gaming: {
    nome: "GAMING PRO",
    descricao: "Aguardando sincronização de dados."
  }
};

function atualizarStatus(id, conectado, descricao) {
  document.querySelectorAll(
    "#integrationOverview .project, " +
    "#settingsIntegrations .project"
  ).forEach(linha => {
    const nome = linha.querySelector(".projectBody b");

    if (nome?.textContent.trim() !== projetos[id].nome) {
      return;
    }

    const pill = linha.querySelector(".pill");
    const p = linha.querySelector(".projectBody p");

    if (pill) {
      pill.textContent = conectado
        ? "Sincronizado"
        : "Pendente";

      pill.className = conectado
        ? "pill ok"
        : "pill warn";
    }

    if (p) p.textContent = descricao;
  });
}

async function consultar() {
  const usuario = auth.currentUser;
  if (!usuario) return;

  const adminDoc = await getDoc(
    doc(db, "admins", usuario.uid)
  );

  const dadosAdmin = adminDoc.exists()
    ? adminDoc.data()
    : {};

  if (
    dadosAdmin.active !== true &&
    dadosAdmin.ative !== true
  ) {
    return;
  }

  for (const id of Object.keys(projetos)) {
    try {
      const snap = await getDoc(
        doc(db, "settings", id + "Sync")
      );

      const dados = snap.exists() ? snap.data() : {};

      const conectado = dados.status === "connected";

      atualizarStatus(
        id,
        conectado,
        conectado
          ? "Sincronização administrativa confirmada."
          : projetos[id].descricao
      );
    } catch (erro) {
      console.error("Integração " + id, erro);
    }
  }
}

onAuthStateChanged(auth, usuario => {
  if (usuario) consultar().catch(console.error);
});

document.getElementById("refresh")
  ?.addEventListener("click", () => {
    consultar().catch(console.error);
  });
