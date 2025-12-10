// Firebase Configuration
// This file is auto-generated based on user input.

const firebaseConfig = {
    apiKey: "AIzaSyD_oxIEUGjcCjq4NW4aduH6SgxKEKEY5bM",
    authDomain: "christmas-toqn.firebaseapp.com",
    projectId: "christmas-toqn",
    storageBucket: "christmas-toqn.firebasestorage.app",
    messagingSenderId: "648263642402",
    appId: "1:648263642402:web:aaa324421bd64917f3497b",
    measurementId: "G-SMDJ1EF2PG"
};

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, doc, getDoc, setDoc, updateDoc, onSnapshot, increment };
