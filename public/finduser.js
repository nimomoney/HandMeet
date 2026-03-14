import { db, auth } from "./firebase-config.js";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    setDoc,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- CONFIGURATION & VARIABLES ---
let currentUserData = null;
let potentialMatches = [];
let currentIndex = 0;

// 1. Fonction de calcul de distance (Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
}

// 2. Initialisation : Récupérer mon profil et lancer la recherche
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "utilisateurs", user.uid));
        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            loadPotentialMatches();
        } else {
            console.error("Profil introuvable.");
        }
    } else {
        window.location.href = "login.html";
    }
});

// 3. Charger les utilisateurs compatibles (Filtrage)
async function loadPotentialMatches() {
    if (!currentUserData || !currentUserData.location) {
        console.error("Données de localisation manquantes pour l'utilisateur actuel.");
        return;
    }

    try {
        // A. Récupérer mes actions passées (Like/Dislike) pour ne pas revoir les profils
        const myActionsSnapshot = await getDocs(collection(db, "utilisateurs", auth.currentUser.uid, "actions"));
        const seenUserIds = myActionsSnapshot.docs.map(doc => doc.id);
        seenUserIds.push(auth.currentUser.uid); // Ne pas se voir soi-même

        // B. Chercher les utilisateurs avec le même type de relation
        const usersRef = collection(db, "utilisateurs");
        const q = query(usersRef, where("type_relation", "==", currentUserData.type_relation));
        const querySnapshot = await getDocs(q);
        
        const results = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            
            // Filtre : Pas déjà vu + possède une localisation
            if (!seenUserIds.includes(docSnap.id) && data.location && data.location.lat) {
                const dist = calculateDistance(
                    currentUserData.location.lat,
                    currentUserData.location.lng,
                    data.location.lat,
                    data.location.lng
                );
                results.push({ id: docSnap.id, ...data, distance: dist });
            }
        });

        // C. Trier par distance et stocker
        results.sort((a, b) => a.distance - b.distance);
        potentialMatches = results;
        displayMatch(currentIndex);

    } catch (error) {
        console.error("Erreur lors du chargement des profils :", error);
    }
}

// 4. Afficher le profil actuel
function displayMatch(index) {
    const cardContainer = document.getElementById("tinder-card");

    if (index >= potentialMatches.length) {
        cardContainer.innerHTML = `
            <div class="card" style="display:flex; align-items:center; justify-content:center; text-align:center; padding:20px;">
                <div>
                    <i class="fa-solid fa-earth-africa" style="font-size:3rem; color:var(--primary-color); margin-bottom:15px;"></i>
                    <p>Plus personne à proximité pour le moment...</p>
                </div>
            </div>`;
        return;
    }

    const match = potentialMatches[index];
    
    // Mise à jour de l'interface
    document.getElementById("card-bg").style.backgroundImage = `url('${match.photoURL || 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=500'}')`;
    document.getElementById("user-name").innerText = match.prenom;
    document.getElementById("user-age").innerText = match.age + " ans";
    
    const badgeContainer = document.getElementById("user-badges");
    badgeContainer.innerHTML = `
        <span class="badge"><i class="fa-solid fa-wheelchair"></i> ${match.type_handicap}</span>
        <span class="badge"><i class="fa-solid fa-location-dot"></i> à ${Math.round(match.distance)} km</span>
    `;
}

// 5. Gestion des actions (Like / Dislike)
async function handleAction(type) {
    const targetUser = potentialMatches[currentIndex];
    if (!targetUser) return;

    const myId = auth.currentUser.uid;
    const targetId = targetUser.id;

    try {
        // A. Enregistrer l'action dans Firestore
        await setDoc(doc(db, "utilisateurs", myId, "actions", targetId), {
            type: type,
            at: serverTimestamp()
        });

        // B. Si c'est un LIKE, vérifier le Match mutuel
        if (type === 'like') {
            const otherActionDoc = await getDoc(doc(db, "utilisateurs", targetId, "actions", myId));
            
            if (otherActionDoc.exists() && otherActionDoc.data().type === 'like') {
                // MATCH CONFIRMÉ
                await createMatchConversation(targetId, targetUser.prenom);
                
                // Alerte visuelle (utilise SweetAlert2 si présent dans ton HTML)
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        title: 'Match !',
                        text: `Vous avez un match avec ${targetUser.prenom} !`,
                        icon: 'success',
                        confirmButtonText: 'Lui écrire',
                        showCancelButton: true,
                        cancelButtonText: 'Continuer'
                    }).then((result) => {
                        if (result.isConfirmed) window.location.href = "chats.html";
                    });
                } else {
                    alert(`Match avec ${targetUser.prenom} !`);
                }
            }
        }

        // C. Passer au profil suivant
        currentIndex++;
        displayMatch(currentIndex);

    } catch (error) {
        console.error("Erreur action:", error);
    }
}

// 6. Création de la conversation en cas de Match
async function createMatchConversation(targetId, targetName, targetPhoto) {
    const convRef = collection(db, "conversations");
    await addDoc(convRef, {
        participants: [auth.currentUser.uid, targetId],
        lastMessage: "C'est un match ! Commencez à discuter.",
        lastUpdate: serverTimestamp(), // Doit correspondre à l'orderBy de chats.js
        users: {
            [auth.currentUser.uid]: {
                prenom: currentUserData.prenom,
                photo: currentUserData.photoURL || ""
            },
            [targetId]: {
                prenom: targetName,
                photo: targetPhoto || ""
            }
        }
    });
}

// --- LIAISON AVEC LE HTML ---
window.likeUser = () => handleAction('like');
window.dislikeUser = () => handleAction('dislike');
window.chargerSuivant = () => {
    currentIndex++;
    displayMatch(currentIndex);
};