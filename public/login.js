import { db, auth } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loginForm = document.getElementById("login-form");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      const docRef = doc(db, "utilisateurs", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const donnees = docSnap.data();

        console.log("Connexion réussie !");
        await Swal.fire({
          title: "Bienvenue Elian " + donnees.prenom + " !",
          text: "Connexion réussie à HandMeet",
          icon: "success",
          confirmButtonColor: "#3085d6",
          confirmButtonText: "C'est parti !",
        });

        localStorage.setItem("user_nom", donnees.nom);
        localStorage.setItem("user_prenom", donnees.prenom);

        window.location.href = "accueil.html";
      } else {
        console.log("Aucun profil trouvé dans Firestore pour cet UID.");
      }
    } catch (error) {
      console.error("Erreur de connexion :", error.code);

      if (error.code === "auth/invalid-credential") {
        await Swal.fire({
          title: ("Email ou mot de passe incorrect."),
          text: "Connexion ratée à HandMeet",
          icon: "error",
          confirmButtonColor: "#3085d6",
          confirmButtonText: "Ok",
        });
      } else {
        alert("Une erreur est survenue lors de la connexion.");
      }
    }
  });
}
