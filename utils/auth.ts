import { createUserWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export const login = async (email: string, password: string) => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    throw error;
  }
};

export const signup = async (email: string, password: string, displayName?: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(userCredential.user, { displayName });
    }
    // Lưu trữ hồ sơ cơ bản trong Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email,
      displayName: displayName || email,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    throw error;
  }
};

// Đổi tên để tránh trùng lặp
export const logout = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    throw error;
  }
};

export const useAuthState = (callback: (user: any) => void) => {
  return onAuthStateChanged(auth, callback);
};