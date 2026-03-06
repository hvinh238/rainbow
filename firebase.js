import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'; // Để lưu trữ hồ sơ người dùng nếu cần
    const firebaseConfig = { 
  apiKey : "AIzaSyCg6TPMbGGIVbg5xWBLR6nVFFT1wNOf7SM" , 
  authDomain : "libary-10c0d.firebaseapp.com" , 
  projectId : "libary-10c0d" , 
  storageBucket : "libary-10c0d.firebasestorage.app" , 
  messagingSenderId : "238779059077" , 
  appId : "1:238779059077:web:b875e4d6f7cfc5f6e812ec" , 
  measurementId : "G-ZC3H0DKPKY" 
};
    const app = initializeApp(firebaseConfig);
    export const auth = getAuth(app);
     export const db = getFirestore(app);  // Tùy chọn để lưu trữ yêu thích của người dùng
    export default app;