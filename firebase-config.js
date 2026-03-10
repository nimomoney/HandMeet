import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyABdNT0uU08RKu6l0D4M-YCLTYb-zXARXw",
    authDomain: "spotify-exporter-ef98d.firebaseapp.com",
    projectId: "spotify-exporter-ef98d",
    storageBucket: "spotify-exporter-ef98d.firebasestorage.app",
    messagingSenderId: "1068097436288",
    appId: "1:1068097436288:web:84610c67553d143864c465"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);