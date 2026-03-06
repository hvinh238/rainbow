import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { auth, db } from '../firebase';

export interface User {
  id: string;
  email: string;
  name?: string;
  friends?: string[];
  friendRequests?: FriendRequest[];
}

export interface FriendRequest {
  from: string;
  status: 'pending' | 'accepted' | 'rejected';
  sentAt: any;
}

// 🔍 Tìm user bằng email
export const searchUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.trim().toLowerCase()));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const userDoc = snapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() } as User;
  } catch (error) {
    console.error('Error searching user:', error);
    throw new Error('Không thể tìm kiếm người dùng');
  }
};

// 📨 Gửi lời mời kết bạn
export const sendFriendRequest = async (toUserId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  try {
    const toUserRef = doc(db, 'users', toUserId);
    const toUserSnap = await getDoc(toUserRef);
    
    if (!toUserSnap.exists()) {
      throw new Error('Người dùng không tồn tại');
    }

    const toUserData = toUserSnap.data();
    const existingRequests = toUserData.friendRequests || [];
    
    // Kiểm tra đã gửi request chưa
    if (existingRequests.some((req: any) => req.from === user.uid)) {
      throw new Error('Đã gửi lời mời kết bạn trước đó');
    }

    // Kiểm tra đã là bạn chưa
    if (toUserData.friends?.includes(user.uid)) {
      throw new Error('Đã là bạn bè');
    }

    await updateDoc(toUserRef, {
      friendRequests: arrayUnion({
        from: user.uid,
        status: 'pending',
        sentAt: new Date(),
      }),
    });

  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
};

// ✅ Chấp nhận lời mời kết bạn
export const acceptFriendRequest = async (fromUserId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  try {
    const userRef = doc(db, 'users', user.uid);
    const fromUserRef = doc(db, 'users', fromUserId);

    // Xóa request và thêm vào friends list
    await updateDoc(userRef, {
      friendRequests: arrayRemove({ from: fromUserId, status: 'pending' }),
      friends: arrayUnion(fromUserId),
    });

    await updateDoc(fromUserRef, {
      friends: arrayUnion(user.uid),
    });

  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw new Error('Không thể chấp nhận lời mời kết bạn');
  }
};

// ❌ Từ chối lời mời kết bạn
export const rejectFriendRequest = async (fromUserId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  try {
    const userRef = doc(db, 'users', user.uid);
    
    await updateDoc(userRef, {
      friendRequests: arrayRemove({ from: fromUserId, status: 'pending' }),
    });

  } catch (error) {
    console.error('Error rejecting friend request:', error);
    throw new Error('Không thể từ chối lời mời kết bạn');
  }
};

// 🗑️ Hủy kết bạn
export const removeFriend = async (friendId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  try {
    const userRef = doc(db, 'users', user.uid);
    const friendRef = doc(db, 'users', friendId);

    await updateDoc(userRef, {
      friends: arrayRemove(friendId),
    });

    await updateDoc(friendRef, {
      friends: arrayRemove(user.uid),
    });

  } catch (error) {
    console.error('Error removing friend:', error);
    throw new Error('Không thể hủy kết bạn');
  }
};

// 👥 Lấy danh sách bạn bè
export const getFriendsList = async (): Promise<User[]> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }

    const userData = userSnap.data();
    const friendIds = userData.friends || [];
    
    // Lấy thông tin chi tiết của bạn bè
    const friendsList: User[] = [];
    for (const friendId of friendIds) {
      const friendRef = doc(db, 'users', friendId);
      const friendSnap = await getDoc(friendRef);
      if (friendSnap.exists()) {
        friendsList.push({ id: friendId, ...friendSnap.data() } as User);
      }
    }
    
    return friendsList;
  } catch (error) {
    console.error('Error getting friends list:', error);
    throw new Error('Không thể tải danh sách bạn bè');
  }
};

// 📩 Lấy lời mời kết bạn đã nhận
export const getReceivedRequests = async (): Promise<any[]> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Chưa đăng nhập');

  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }

    const userData = userSnap.data();
    const requests = userData.friendRequests || [];
    
    // Lấy thông tin người gửi
    const requestsWithUserInfo = [];
    for (const request of requests) {
      const fromUserRef = doc(db, 'users', request.from);
      const fromUserSnap = await getDoc(fromUserRef);
      if (fromUserSnap.exists()) {
        const fromUserData = fromUserSnap.data();
        requestsWithUserInfo.push({
          ...request,
          fromUser: { id: request.from, ...fromUserData },
        });
      }
    }
    
    return requestsWithUserInfo;
  } catch (error) {
    console.error('Error getting received requests:', error);
    throw new Error('Không thể tải lời mời kết bạn');
  }
};

// 🔄 Khởi tạo user data nếu chưa có
export const initializeUserData = async (userId: string, email: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        email: email,
        friends: [],
        friendRequests: [],
        createdAt: new Date(),
      });
    }
  } catch (error) {
    console.error('Error initializing user data:', error);
    throw new Error('Không thể khởi tạo dữ liệu người dùng');
  }
};