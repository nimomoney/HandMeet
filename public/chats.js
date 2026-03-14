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
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, auth } from "./firebase-config.js";

// --- 1. DÉCLARATIONS GLOBALES ---
// Ces variables doivent être en dehors des fonctions pour être accessibles partout
let activeConversationId = null;
let unsubscribeMessages = null;

// --- 2. GESTION DE LA LISTE DES DISCUSSIONS ---
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log("Connecté en tant que :", user.uid);

    const colRef = collection(db, "conversations");
    const q = query(
      colRef,
      where("participants", "array-contains", user.uid),
      orderBy("updatedAt", "desc"),
    );

    onSnapshot(
      q,
      (snapshot) => {
        console.log("Succès ! Conversations trouvées :", snapshot.size);
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
      },
      (error) => {
        console.error("Erreur Firestore :", error);
      },
    );
  } else {
    window.location.href = "login.html";
  }
});

// --- 3. OUVRIR UNE CONVERSATION ---
window.openChat = function (convId, name) {
  activeConversationId = convId;
  document.getElementById("active-chat-name").innerText = name;
  document.getElementById("chat-window").classList.remove("hidden");
  document.getElementById("messages-container").innerHTML = "";
  if (unsubscribeMessages) unsubscribeMessages();
  const messagesQuery = query(
    collection(db, "conversations", convId, "messages"),
    orderBy("createdAt", "asc"),
    limit(50),
  );
  unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
    const container = document.getElementById("messages-container");
    container.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const isMe = msg.senderId === auth.currentUser.uid;
      const msgHtml = `<div class="message ${isMe ? "sent" : "received"}">${msg.text}</div>`;
      container.innerHTML += msgHtml;
    });

    container.scrollTop = container.scrollHeight;
  });
};

// --- 4. ENVOYER UN MESSAGE ---
document.getElementById("send-btn").addEventListener("click", async () => {
  const input = document.getElementById("msg-input");
  const text = input.value.trim();

  if (text && activeConversationId) {
    const currentConvId = activeConversationId;
    input.value = "";

    try {
      await addDoc(collection(db, "conversations", currentConvId, "messages"), {
        text: text,
        senderId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
      const convRef = doc(db, "conversations", currentConvId);
      await updateDoc(convRef, {
        lastMessage: text,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Erreur lors de l'envoi :", e);
    }
  }
});

// --- 5. FERMER LE CHAT ---
window.closeChat = function () {
  document.getElementById("chat-window").classList.add("hidden");
  if (unsubscribeMessages) unsubscribeMessages();
  activeConversationId = null;
};
