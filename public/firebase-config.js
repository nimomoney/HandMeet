import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyABdNT0uU08RKu6l0D4M-YCLTYb-zXARXw",
    authDomain: "spotify-exporter-ef98d.firebaseapp.com",
    projectId: "spotify-exporter-ef98d",
    storageBucket: "spotify-exporter-ef98d.firebasestorage.app",
    messagingSenderId: "1068097436288",
    appId: "1:1068097436288:web:84610c67553d143864c465"
};

// Initialisation de l'App
const app = initializeApp(firebaseConfig);

// --- NOUVELLE MÉTHODE DE PERSISTENCE (Firestore 10.8+) ---
// Remplace getFirestore + enableIndexedDbPersistence
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage, app };