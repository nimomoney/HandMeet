import { db, auth, storage } from "./firebase-config.js";
import {
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => console.log("Service Worker enregistré !"))
      .catch((err) => console.log("Erreur SW:", err));
  });
}

const signupForm = document.getElementById("signup-form");

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;
    const passwordConfirm = document.getElementById("signup-password-confirmation").value;
    const prenom = document.getElementById("signup-prenom").value;
    const nom = document.getElementById("signup-nom").value;
    const age = document.getElementById("signup-age").value;
    const handicap = document.getElementById("signup-handicap").value;
    
    const relationElement = document.getElementById("signup-relation");
    const relation = relationElement ? relationElement.value : "Non précisé";
    
    const photoFile = document.getElementById("signup-photo").files[0];
    if (password !== passwordConfirm) {
      Swal.fire({
        title: "Erreur",
        text: "Les mots de passe ne correspondent pas.",
        icon: "error",
        confirmButtonColor: "#7c4dff",
      });
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("Compte Auth créé ! UID :", user.uid);

      let photoURL = "";
      if (photoFile) {
        const fileSizeMB = photoFile.size / (1024 * 1024);

        if (fileSizeMB > 2) {
          await Swal.fire({
            title: "Photo trop lourde",
            text: "Ta photo dépasse 2 Mo. Elle n'a pas été enregistrée, mais ton compte est créé.",
            icon: "warning",
            confirmButtonColor: "#7c4dff",
          });
        } else {
          console.log("Début de l'upload de la photo...");
          const storageRef = ref(storage, `profils/${user.uid}`);
          
          try {
            await uploadBytes(storageRef, photoFile);
            photoURL = await getDownloadURL(storageRef);
            console.log("Photo uploadée avec succès :", photoURL);
          } catch (storageError) {
            console.error("Erreur Storage (CORS ou Forfait) :", storageError);
          }
        }
      }

      await setDoc(doc(db, "utilisateurs", user.uid), {
        prenom: prenom,
        nom: nom,
        age: parseInt(age),
        email: email,
        type_handicap: handicap,
        type_relation: relation,
        photoURL: photoURL,
        date_inscription: new Date(),
      });

      await Swal.fire({
        title: "Bienvenue sur HandMeet !",
        text: `Ravie de te compter parmi nous, ${prenom} !`,
        icon: "success",
        confirmButtonColor: "#7c4dff",
        confirmButtonText: "Commencer",
      });

      window.location.href = "accueil.html";

    } catch (error) {
      console.error("Erreur complète :", error);

      let message = "Une erreur est survenue lors de l'inscription.";

      if (error.code === "auth/email-already-in-use") {
        message = "Cet email est déjà utilisé.";
      } else if (error.code === "auth/weak-password") {
        message = "Le mot de passe doit faire au moins 6 caractères.";
      } else if (error.code === "auth/invalid-email") {
        message = "Format d'email invalide.";
      }

      Swal.fire({
        title: "Oups !",
        text: message,
        icon: "error",
        confirmButtonColor: "#7c4dff",
        confirmButtonText: "Réessayer",
      });
    }
  });
}