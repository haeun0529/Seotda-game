// Firebase 초기화 - 프로젝트: custom-seotda
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB63YhhPTmZtgTMseGeplwlKK9xLe5GGak",
  authDomain: "custom-seotda.firebaseapp.com",
  projectId: "custom-seotda",
  storageBucket: "custom-seotda.firebasestorage.app",
  messagingSenderId: "10962741352",
  appId: "1:10962741352:web:ab02ec989c57f8dbfd73dd",
  measurementId: "G-9ZXHDCV431"
};

export const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});