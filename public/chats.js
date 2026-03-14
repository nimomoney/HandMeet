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
let lastVisibleDoc = null;
let allMessages = [];
let isLoadingHistory = false;

// --- 2. GESTION DE LA LISTE DES DISCUSSIONS ---
auth.onAuthStateChanged((user) => {
  if (user) {
    const colRef = collection(db, "conversations");
    // On trie par lastUpdate pour avoir les derniers messages en haut
    const q = query(
      colRef,
      where("participants", "array-contains", user.uid),
      orderBy("lastUpdate", "desc"),
    );

    onSnapshot(
      q,
      (snapshot) => {
        const listContainer = document.getElementById("conversations-list");
        listContainer.innerHTML = "";

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const convId = docSnap.id;

          // Trouver l'ID de l'autre utilisateur
          const otherId = data.participants.find((id) => id !== user.uid);

          // Utilisation du champ 'users' comme dans ton Firestore
          const info = data.users ? data.users[otherId] : null;

          if (info) {
            const photoUrl =
              info.photo ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${info.prenom}`;

            listContainer.innerHTML += `
            <div class="chat-item" onclick="openChat('${convId}', '${info.prenom}', '${photoUrl}')">
                <img src="${photoUrl}" class="chat-avatar" onerror="this.src='default-avatar.png'">
                <div class="chat-info">
                    <span class="chat-name">${info.prenom}</span>
                    <span class="msg-text">${data.lastMessage || "Nouveau match ! Dites bonjour 👋"}</span>
                </div>
            </div>`;
          }
        });
      },
      (error) => console.error("Erreur Firestore Liste:", error),
    );
  } else {
    window.location.href = "login.html";
  }
});

// --- 3. OUVRIR UNE CONVERSATION ---
window.openChat = async function (convId, name, photoUrl) {
  activeConversationId = convId;
  allMessages = [];
  lastVisibleDoc = null;

  // MISE À JOUR DE L'ENTÊTE (NOM + PHOTO)
  document.getElementById("active-chat-name").innerText = name;
  const headerAvatar = document.getElementById("active-chat-avatar");
  if (headerAvatar) {
    headerAvatar.src = photoUrl;
  }

  document.getElementById("chat-window").classList.remove("hidden");
  document.getElementById("messages-container").innerHTML = "";
  document.getElementById("msg-input").focus();

  if (unsubscribeMessages) unsubscribeMessages();

  const msgColRef = collection(db, "conversations", convId, "messages");
  const q = query(msgColRef, orderBy("createdAt", "desc"), limit(25));

  // --- CHARGEMENT CACHE ---
  try {
    const cacheSnap = await getDocs(query(q, { source: "cache" }));
    if (!cacheSnap.empty) {
      const cacheMessages = [];
      cacheSnap.forEach((docSnap) => {
        cacheMessages.push({ id: docSnap.id, ...docSnap.data() });
      });
      mergeMessages(cacheMessages);
      renderMessages(true);
      lastVisibleDoc = cacheSnap.docs[cacheSnap.docs.length - 1];
    }
  } catch (e) {
    console.log("Cache vide, attente du serveur...");
  }

  // --- TEMPS RÉEL ---
  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    if (!lastVisibleDoc && snapshot.docs.length > 0) {
      lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    const tempMessages = [];
    snapshot.forEach((docSnap) => {
      tempMessages.push({ id: docSnap.id, ...docSnap.data() });
    });

    mergeMessages(tempMessages);
    renderMessages(true);
  });
};

// --- 4. CHARGER L'HISTORIQUE (SCROLL UP) ---
async function loadMoreMessages() {
  if (!activeConversationId || !lastVisibleDoc || isLoadingHistory) return;

  isLoadingHistory = true;
  const q = query(
    collection(db, "conversations", activeConversationId, "messages"),
    orderBy("createdAt", "desc"),
    startAfter(lastVisibleDoc),
    limit(25),
  );

  try {
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
      const oldMessages = [];
      snapshot.forEach((docSnap) => {
        oldMessages.push({ id: docSnap.id, ...docSnap.data() });
      });
      mergeMessages(oldMessages);
      renderMessages(false);
    }
  } catch (error) {
    console.error("Erreur historique:", error);
  } finally {
    isLoadingHistory = false;
  }
}

// --- 5. LOGIQUE D'AFFICHAGE ---
function mergeMessages(newBatch) {
  newBatch.forEach((msg) => {
    const index = allMessages.findIndex((m) => m.id === msg.id);
    if (index === -1) {
      allMessages.push(msg);
    } else {
      allMessages[index] = msg;
    }
  });

  allMessages.sort((a, b) => {
    const timeA = a.createdAt?.toMillis() || 0;
    const timeB = b.createdAt?.toMillis() || 0;
    return timeA - timeB;
  });
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
    container.scrollTop = container.scrollHeight - previousHeight;
  }
}

document
  .getElementById("messages-container")
  .addEventListener("scroll", (e) => {
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

    try {
      // 1. Ajouter le message
      await addDoc(collection(db, "conversations", currentConvId, "messages"), {
        text: text,
        senderId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });

      // 2. Mettre à jour la conversation pour la liste
      await updateDoc(doc(db, "conversations", currentConvId), {
        lastMessage: text,
        lastUpdate: serverTimestamp(),
      });
    } catch (e) {
      console.error("Erreur envoi:", e);
    }
  }
};

document
  .getElementById("send-btn")
  .addEventListener("click", handleSendMessage);
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
