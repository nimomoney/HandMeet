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

// 3. Charger les utilisateurs compatibles
async function loadPotentialMatches() {
    if (!currentUserData || !currentUserData.location) {
        console.error("Données de localisation manquantes.");
        return;
    }

    try {
        const myActionsSnapshot = await getDocs(collection(db, "utilisateurs", auth.currentUser.uid, "actions"));
        const seenUserIds = myActionsSnapshot.docs.map(doc => doc.id);
        seenUserIds.push(auth.currentUser.uid); 

        const usersRef = collection(db, "utilisateurs");
        const q = query(usersRef, where("type_relation", "==", currentUserData.type_relation));
        const querySnapshot = await getDocs(q);
        
        const results = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
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

        results.sort((a, b) => a.distance - b.distance);
        potentialMatches = results;
        displayMatch(currentIndex);

    } catch (error) {
        console.error("Erreur chargement profils :", error);
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
    document.getElementById("card-bg").style.backgroundImage = `url('${match.photoURL || 'default-avatar.png'}')`;
    document.getElementById("user-name").innerText = match.prenom;
    document.getElementById("user-age").innerText = match.age + " ans";
    
    const badgeContainer = document.getElementById("user-badges");
    badgeContainer.innerHTML = `
        <span class="badge"><i class="fa-solid fa-wheelchair"></i> ${match.type_handicap}</span>
        <span class="badge"><i class="fa-solid fa-location-dot"></i> à ${Math.round(match.distance)} km</span>
    `;
}

// 5. Gestion des actions (Like / Dislike) avec SweetAlert2
async function handleAction(type) {
    const targetUser = potentialMatches[currentIndex];
    if (!targetUser) return;

    const myId = auth.currentUser.uid;
    const targetId = targetUser.id;

    try {
        await setDoc(doc(db, "utilisateurs", myId, "actions", targetId), {
            type: type,
            at: serverTimestamp()
        });

        if (type === 'like') {
            const otherActionDoc = await getDoc(doc(db, "utilisateurs", targetId, "actions", myId));
            
            if (otherActionDoc.exists() && otherActionDoc.data().type === 'like') {
                // MATCH CONFIRMÉ
                await createMatchConversation(targetId, targetUser.prenom, targetUser.photoURL);
                
                // Alerte stylisée SweetAlert2
                Swal.fire({
                    title: 'C\'est un Match ! 💜',
                    text: `Toi et ${targetUser.prenom} vous plaisez mutuellement.`,
                    imageUrl: targetUser.photoURL || 'default-avatar.png',
                    imageWidth: 100,
                    imageHeight: 100,
                    imageAlt: 'Photo du match',
                    showCancelButton: true,
                    confirmButtonColor: '#7c4dff',
                    cancelButtonColor: '#ccc',
                    confirmButtonText: 'Lui envoyer un message',
                    cancelButtonText: 'Continuer',
                    didOpen: () => {
                        const img = Swal.getImage();
                        if (img) img.style.borderRadius = '50%';
                    }
                }).then((result) => {
                    if (result.isConfirmed) window.location.href = "chats.html";
                });
            }
        }

        currentIndex++;
        displayMatch(currentIndex);

    } catch (error) {
        console.error("Erreur action:", error);
    }
}

// 6. Création de la conversation (Champs harmonisés : lastUpdate et users)
async function createMatchConversation(targetId, targetName, targetPhoto) {
    const convRef = collection(db, "conversations");
    await addDoc(convRef, {
        participants: [auth.currentUser.uid, targetId],
        lastMessage: "C'est un match ! Commencez à discuter.",
        lastUpdate: serverTimestamp(), 
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