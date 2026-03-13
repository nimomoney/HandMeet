import { db, auth } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

onAuthStateChanged(auth, async (user) => {
    if (user) {

        const docRef = doc(db, "utilisateurs", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const donnees = docSnap.data();

            document.getElementById("affichage-prenom").innerText = donnees.prenom;
            document.getElementById("affichage-nom").innerText = donnees.nom;
            document.getElementById("affichage-age").innerText = donnees.age;
            document.getElementById("affichage-email").innerText = donnees.email;

            const cardImage = document.getElementById("photo-profil-background");
            
            if (donnees.photoURL) {
                cardImage.style.backgroundImage = `url('${donnees.photoURL}')`;
                cardImage.style.backgroundSize = "cover";
                cardImage.style.backgroundPosition = "center";
            } else {
                cardImage.style.background = "linear-gradient(to bottom, #7c4dff, #2d3436)";
            }
        }
    } else {
        window.location.href = "login.html";
    }
});
document.getElementById("btn-deconnexion").addEventListener("click", () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
});