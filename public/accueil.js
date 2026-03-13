import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Utilisateur connecté sur l'accueil :", user.uid);
    } else {
        console.log("Accès refusé, redirection vers login...");
        window.location.href = "login.html";
    }
});