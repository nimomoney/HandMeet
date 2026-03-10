import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loginForm = document.getElementById("login-form");
const maCollection = collection(db, "utilisateurs");

if (loginForm) {
  console.log("JS chargé et formulaire détecté !");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email").value;

    try {
      const maRecherche = query(maCollection, where("email", "==", email));
      const snapshot = await getDocs(maRecherche);

      if (snapshot.empty) {
        console.log("Aucun utilisateur trouvé avec cet email");
      } else {
        console.log("Utilisateur trouvé !");

        snapshot.forEach((utilisateur) => {
          // console.log("Email en base :", utilisateur.data().email);

          const donnees = utilisateur.data();
          alert("Bienvenue " + donnees.prenom + " " + donnees.nom);
          localStorage.setItem("user_nom", donnees.nom);
          localStorage.setItem("user_prenom", donnees.prenom);
          localStorage.setItem("user_email", donnees.email);
          window.location.href = "accueil.html";
        });
      }
    } catch (error) {
      console.error("Détails :", error);
    }
  });
}
