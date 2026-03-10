import { db } from './firebase-config.js'; 
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const signupForm = document.getElementById('signup-form');

if (signupForm) {
    console.log("JS chargé et formulaire détecté !");

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        console.log("Tentative d'inscription...");

        const prenom = document.getElementById('signup-prenom').value;
        const nom = document.getElementById('signup-nom').value;
        const age = document.getElementById('signup-age').value;
        const email = document.getElementById('signup-email').value;
        const handicap = document.getElementById('signup-handicap').value;

        try {
            const docRef = await addDoc(collection(db, "utilisateurs"), {
                prenom: prenom,
                nom: nom,
                age: parseInt(age),
                email: email,
                type_handicap: handicap,
                date_inscription: new Date()
            });

            console.log("Utilisateur créé avec l'ID: ", docRef.id);
            alert("Compte créé avec succès !");
            window.location.href = "accueil.html";

        } catch (error) {
            console.error("Erreur Firebase : ", error);
            alert("Erreur lors de l'inscription : " + error.message);
        }
    });
} else {
    console.error("Erreur : Le formulaire #signup-form n'a pas été trouvé.");
}