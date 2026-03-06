import {
    addDoc,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    query,
    Unsubscribe,
    updateDoc,
    where
} from 'firebase/firestore';
import { auth, db } from '../firebase';

export interface GroupFund {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  createdBy: string;
  members: string[];
  description: string;
  createdAt: any;
}

export interface FundContribution {
  id: string;
  fundId: string;
  userId: string;
  amount: number;
  createdAt: any;
}

// 🆕 Tạo quỹ mới
export const createGroupFund = async (
  name: string, 
  targetAmount: number, 
  description: string, 
  members: string[]
): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  try {
    const allMembers = [user.uid, ...members];
    
    const docRef = await addDoc(collection(db, 'groupFunds'), {
      name,
      targetAmount: Number(targetAmount),
      currentAmount: 0,
      createdBy: user.uid,
      members: allMembers,
      description,
      createdAt: new Date(),
    });

    return docRef.id;
  } catch (error) {
    console.error('Error creating group fund:', error);
    throw new Error('Không thể tạo quỹ mới');
  }
};

// 💰 Đóng góp vào quỹ
export const contributeToFund = async (
  fundId: string, 
  amount: number
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  try {
    const fundRef = doc(db, 'groupFunds', fundId);
    const fundSnap = await getDocs(query(collection(db, 'groupFunds'), where('__name__', '==', fundId)));
    
    if (fundSnap.empty) {
      throw new Error('Quỹ không tồn tại');
    }

    const fundData = fundSnap.docs[0].data();
    const newAmount = fundData.currentAmount + amount;
    
    await updateDoc(fundRef, {
      currentAmount: newAmount,
    });

    // Ghi lại lịch sử đóng góp
    await addDoc(collection(db, 'fundContributions'), {
      fundId,
      userId: user.uid,
      amount,
      createdAt: new Date(),
    });

  } catch (error) {
    console.error('Error contributing to fund:', error);
    throw new Error('Không thể đóng góp vào quỹ');
  }
};

// 📊 Lấy danh sách quỹ của user
export const getUserGroupFunds = (
  callback: (funds: GroupFund[]) => void
): Unsubscribe => {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  const fundsRef = collection(db, 'groupFunds');
  const q = query(fundsRef, where('members', 'array-contains', user.uid));
  
  return onSnapshot(q, (snapshot) => {
    const funds = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as GroupFund[];
    callback(funds);
  });
};

// 🗑️ Xóa quỹ
export const deleteGroupFund = async (fundId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  try {
    // Kiểm tra quyền (chỉ người tạo mới được xóa)
    const fundRef = doc(db, 'groupFunds', fundId);
    const fundSnap = await getDocs(query(collection(db, 'groupFunds'), where('__name__', '==', fundId)));
    
    if (!fundSnap.empty) {
      const fundData = fundSnap.docs[0].data();
      if (fundData.createdBy !== user.uid) {
        throw new Error('Chỉ người tạo quỹ mới được xóa');
      }
    }

    await deleteDoc(fundRef);
  } catch (error) {
    console.error('Error deleting group fund:', error);
    throw error;
  }
};

// 📈 Lấy lịch sử đóng góp của quỹ
export const getFundContributions = async (fundId: string): Promise<FundContribution[]> => {
  try {
    const contributionsRef = collection(db, 'fundContributions');
    const q = query(contributionsRef, where('fundId', '==', fundId));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as FundContribution[];
  } catch (error) {
    console.error('Error getting fund contributions:', error);
    throw new Error('Không thể tải lịch sử đóng góp');
  }
};

// 👥 Thêm thành viên vào quỹ
export const addMemberToFund = async (fundId: string, memberId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  try {
    const fundRef = doc(db, 'groupFunds', fundId);
    
    await updateDoc(fundRef, {
      members: arrayUnion(memberId),
    });
  } catch (error) {
    console.error('Error adding member to fund:', error);
    throw new Error('Không thể thêm thành viên vào quỹ');
  }
};