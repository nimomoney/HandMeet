import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
  doc,
  updateDoc,
  startAfter,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, auth } from "./firebase-config.js";

// --- 1. DÉCLARATIONS GLOBALES ---
let activeConversationId = null;
let unsubscribeMessages = null;
let lastVisibleDoc = null; // Le document curseur pour la pagination
let allMessages = [];      // Stockage local de tous les messages chargés
let isLoadingHistory = false;

// --- 2. GESTION DE LA LISTE DES DISCUSSIONS ---
auth.onAuthStateChanged((user) => {
  if (user) {
    const colRef = collection(db, "conversations");
    const q = query(
      colRef,
      where("participants", "array-contains", user.uid),
      orderBy("updatedAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
      const listContainer = document.getElementById("conversations-list");
      listContainer.innerHTML = "";

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const convId = docSnap.id;
        const otherId = data.participants.find((id) => id !== user.uid);
        const info = data.userInfo[otherId];

        if (info) {
          listContainer.innerHTML += `
            <div class="chat-item" onclick="openChat('${convId}', '${info.prenom}')">
                <img src="${info.photo || "default-avatar.png"}" class="chat-avatar" onerror="this.src='default-avatar.png'">
                <div class="chat-info">
                    <span class="chat-name">${info.prenom}</span>
                    <span class="msg-text">${data.lastMessage || "Nouvelle conversation"}</span>
                </div>
            </div>`;
        }
      });
    }, (error) => console.error("Erreur Firestore :", error));
  } else {
    window.location.href = "login.html";
  }
});

// --- 3. OUVRIR UNE CONVERSATION ---
window.openChat = function (convId, name) {
  activeConversationId = convId;
  allMessages = [];    // Reset du stockage local
  lastVisibleDoc = null; 
  
  document.getElementById("active-chat-name").innerText = name;
  document.getElementById("chat-window").classList.remove("hidden");
  document.getElementById("messages-container").innerHTML = "";
  document.getElementById("msg-input").focus();

  if (unsubscribeMessages) unsubscribeMessages();

  // ÉCOUTE DES 25 DERNIERS MESSAGES (TEMPS RÉEL)
  const q = query(
    collection(db, "conversations", convId, "messages"),
    orderBy("createdAt", "desc"),
    limit(25)
  );

  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    // On récupère le curseur pour la pagination initiale
    if (!lastVisibleDoc && snapshot.docs.length > 0) {
      lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    const tempMessages = [];
    snapshot.forEach(docSnap => {
      tempMessages.push({ id: docSnap.id, ...docSnap.data() });
    });

    mergeMessages(tempMessages);
    renderMessages(true); // true = scroll en bas
  });
};

// --- 4. CHARGER L'HISTORIQUE (SCROLL UP - AVEC OPTIMISATION CACHE) ---
async function loadMoreMessages() {
  if (!activeConversationId || !lastVisibleDoc || isLoadingHistory) return;

  isLoadingHistory = true;
  console.log("Tentative de chargement de l'historique...");

  const q = query(
    collection(db, "conversations", activeConversationId, "messages"),
    orderBy("createdAt", "desc"),
    startAfter(lastVisibleDoc),
    limit(25)
  );

  try {
    let snapshot;
    try {
      // 1. On tente de forcer la lecture depuis le cache (0 lecture facturée)
      snapshot = await getDocs(query(q, { source: "cache" }));
      console.log("Chargement historique depuis le CACHE");
    } catch (cacheError) {
      // 2. Si le cache n'a pas les données, on va sur le serveur
      snapshot = await getDocs(q);
      console.log("Chargement historique depuis le SERVEUR");
    }

    if (!snapshot.empty) {
      lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
      
      const oldMessages = [];
      snapshot.forEach(docSnap => {
        oldMessages.push({ id: docSnap.id, ...docSnap.data() });
      });

      mergeMessages(oldMessages);
      renderMessages(false); // false = préserve la position du scroll
    } else {
      console.log("Plus aucun message ancien à charger.");
    }
  } catch (error) {
    console.error("Erreur lors du chargement de l'historique :", error);
  } finally {
    isLoadingHistory = false;
  }
}

// --- 5. LOGIQUE D'AFFICHAGE ET FUSION ---

function mergeMessages(newBatch) {
  newBatch.forEach(msg => {
    if (!allMessages.find(m => m.id === msg.id)) {
      allMessages.push(msg);
    }
  });
  // Tri chronologique : plus vieux en haut, plus récents en bas
  allMessages.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
}

function renderMessages(shouldScrollToBottom) {
  const container = document.getElementById("messages-container");
  const previousHeight = container.scrollHeight;

  container.innerHTML = "";
  allMessages.forEach((msg) => {
    const isMe = msg.senderId === auth.currentUser.uid;
    const msgHtml = `<div class="message ${isMe ? "sent" : "received"}">${msg.text}</div>`;
    container.innerHTML += msgHtml;
  });

  if (shouldScrollToBottom) {
    container.scrollTop = container.scrollHeight;
  } else {
    // Maintient la position pour éviter que l'écran "saute" lors du chargement
    container.scrollTop = container.scrollHeight - previousHeight;
  }
}

// Détection du scroll vers le haut
document.getElementById("messages-container").addEventListener("scroll", (e) => {
  if (e.target.scrollTop === 0) {
    loadMoreMessages();
  }
});

// --- 6. ENVOYER UN MESSAGE ---
const handleSendMessage = async () => {
  const input = document.getElementById("msg-input");
  const text = input.value.trim();

  if (text && activeConversationId) {
    const currentConvId = activeConversationId;
    input.value = "";
    input.focus();

    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 1); 

    try {
      await addDoc(collection(db, "conversations", currentConvId, "messages"), {
        text: text,
        senderId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        expireAt: expireDate,
      });

      await updateDoc(doc(db, "conversations", currentConvId), {
        lastMessage: text,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Erreur envoi:", e);
    }
  }
};

document.getElementById("send-btn").addEventListener("click", handleSendMessage);
document.getElementById("msg-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleSendMessage();
  }
});

// --- 7. FERMER LE CHAT ---
window.closeChat = function () {
  document.getElementById("chat-window").classList.add("hidden");
  if (unsubscribeMessages) unsubscribeMessages();
  activeConversationId = null;
  allMessages = [];
  lastVisibleDoc = null;
};