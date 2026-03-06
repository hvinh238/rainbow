import {
    addDoc, collection, deleteDoc, doc, getDoc,
    Timestamp,
    updateDoc
} from "firebase/firestore";
import { auth, db } from "../firebase";

// 🔹 Thêm giao dịch mới
export const addTransaction = async (data: any) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Người dùng chưa đăng nhập");

  const ref = collection(db, "users", user.uid, "transactions");
  return await addDoc(ref, {
    ...data,
    createdAt: data.createdAt || Timestamp.now(),
  });
};

// 🔹 Cập nhật giao dịch
export const updateTransaction = async (id: string, data: any) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Người dùng chưa đăng nhập");

  const ref = doc(db, "users", user.uid, "transactions", id);
  return await updateDoc(ref, { ...data, updatedAt: Timestamp.now() });
};

// 🔹 Xóa giao dịch
export const deleteTransaction = async (id: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Người dùng chưa đăng nhập");

  const ref = doc(db, "users", user.uid, "transactions", id);
  return await deleteDoc(ref);
};

// 🔹 Lấy giao dịch theo ID
export const getTransactionById = async (id: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Người dùng chưa đăng nhập");

  const ref = doc(db, "users", user.uid, "transactions", id);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};
