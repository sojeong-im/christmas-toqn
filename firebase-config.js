// ⚠️ 중요: Firebase 콘솔에서 복사한 설정값을 아래에 덮어쓰기 하세요!
// 1. https://console.firebase.google.com/ 접속
// 2. 프로젝트 설정 -> 일반 -> 내 앱 -> SDK 설정 및 구성 -> 'Config' 선택
// 3. const firebaseConfig = { ... }; 부분을 복사해서 아래에 붙여넣기

const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// -----------------------------------------------------------
// 아래는 건드리지 마세요! (Firebase 초기화 코드)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, doc, getDoc, setDoc, updateDoc, onSnapshot, increment };
