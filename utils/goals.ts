import { addDoc, collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";

// 🐷 Thêm 1 heo đất mới cho user hiện tại
export const addGoal = async (goalName: string, goalAmount: number) => {
  const user = auth.currentUser;
  if (!user) return alert("Vui lòng đăng nhập!");

  const goalsRef = collection(db, "users", user.uid, "goals");
  await addDoc(goalsRef, {
    name: goalName,
    amount: goalAmount,
    current: 0,
    createdAt: new Date(),
  });
};

// 📥 Lấy danh sách heo đất của user hiện tại
export const getUserGoals = async () => {
  const user = auth.currentUser;
  if (!user) return [];

  const goalsRef = collection(db, "users", user.uid, "goals");
  const snapshot = await getDocs(goalsRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
