const nom = localStorage.getItem("user_nom");
const prenom = localStorage.getItem("user_prenom");
const email = localStorage.getItem("user_email");
const age = localStorage.getItem("user_age");

// Sécurité : si pas d'email, on renvoie à la page de connexion
if (!email) {
    window.location.href = "index.html"; 
} else {
    document.getElementById("affichage-prenom").textContent = prenom;
    document.getElementById("affichage-nom").textContent = nom;
    document.getElementById("affichage-email").textContent = email;
    document.getElementById("affichage-age").textContent = age;
}

document.getElementById("btn-deconnexion").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
});