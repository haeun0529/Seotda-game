// Firebase 초기화 - 프로젝트: custom-seotda
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
// 일부 네트워크(회사망/VPN/방화벽)에서 기본 WebChannel 연결이 막혀 요청이
// 응답 없이 걸려있는 문제가 있어, 자동으로 long-polling으로 전환되게 설정
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

export const auth = getAuth(app);

// 익명 로그인 - 각 브라우저(탭)마다 고유한 uid를 발급받음.
// 이 uid를 손패 등 "본인만 볼 수 있어야 하는 데이터"의 소유자 식별에 사용함.
// 지속성을 세션(탭) 단위로 둬서, 같은 브라우저에서 탭을 여러 개 열어 5명을 테스트해도
// 탭마다 서로 다른 uid를 받게 함 (기본값은 탭끼리 로그인을 공유해버려서 테스트가 안 됨)
let signInPromise = null;
export async function ensureSignedIn() {
  if (auth.currentUser) return auth.currentUser;
  if (!signInPromise) {
    signInPromise = setPersistence(auth, browserSessionPersistence)
      .then(() => signInAnonymously(auth))
      .then(cred => cred.user);
  }
  return signInPromise;
}