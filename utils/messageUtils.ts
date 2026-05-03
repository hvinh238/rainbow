import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import { auth, db } from '../firebase';

// Types - ĐÃ THÊM TRẠNG THÁI TIN NHẮN
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: any;
  read: boolean;
  delivered: boolean;
  type: 'text';
  status: 'sent' | 'delivered' | 'read'; // 🆕 THÊM TRẠNG THÁI
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: any;
  unreadCount: number;
  otherUser?: {
    id: string;
    email: string;
    name: string;
  };
  isNewFriend?: boolean;
}

// 🔥 HÀM QUAN TRỌNG: Kiểm tra kết nối Firebase
const checkFirebaseConnection = () => {
  if (!db) {
    throw new Error('Firestore chưa được khởi tạo');
  }
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User chưa đăng nhập');
  }
  return user;
};

// 🆕 HÀM: Đánh dấu tin nhắn đã giao (delivered)
export const markMessagesAsDelivered = async (conversationId: string, userId: string) => {
  try {
    const MessagesRef = collection(db, 'Messages');
    const q = query(
      MessagesRef,
      where('conversationId', '==', conversationId),
      where('receiverId', '==', userId),
      where('delivered', '==', false)
    );
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { 
        delivered: true,
        status: 'delivered' // 🆕 CẬP NHẬT STATUS
      });
    });
    
    await batch.commit();
    console.log('✅ Đã đánh dấu tin nhắn đã giao');
  } catch (error) {
    console.error('❌ Lỗi đánh dấu tin nhắn đã giao:', error);
  }
};

// 🆕 HÀM: Đánh dấu tin nhắn đã đọc (read)
export const markMessagesAsRead = async (conversationId: string, userId: string) => {
  try {
    const MessagesRef = collection(db, 'Messages');
    const q = query(
      MessagesRef,
      where('conversationId', '==', conversationId),
      where('receiverId', '==', userId),
      where('read', '==', false)
    );
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { 
        read: true,
        status: 'read' // 🆕 CẬP NHẬT STATUS
      });
    });
    
    await batch.commit();
    console.log('✅ Đã đánh dấu tin nhắn đã đọc');
  } catch (error) {
    console.error('❌ Lỗi đánh dấu tin nhắn đã đọc:', error);
  }
};

// 🛠️ SỬA HÀM sendMessage - THÊM TRẠNG THÁI
export const sendMessage = async (
  conversationId: string,
  senderId: string,
  receiverId: string,
  content: string
) => {
  try {
    console.log('🔄 Bắt đầu gửi tin nhắn...', { 
      conversationId, 
      senderId, 
      receiverId, 
      content 
    });
    
    const user = checkFirebaseConnection();
    
    if (!content.trim()) {
      throw new Error('Nội dung tin nhắn không được để trống');
    }

    if (!conversationId) {
      throw new Error('Conversation ID không hợp lệ');
    }

    // 🆕 TIN NHẮN MỚI CÓ STATUS 'sent'
    const messageData = {
      conversationId,
      senderId: user.uid,
      receiverId,
      content: content.trim(),
      timestamp: serverTimestamp(),
      read: false,
      delivered: false,
      type: 'text' as const,
      status: 'sent' as const // 🆕 TRẠNG THÁI BAN ĐẦU
    };

    console.log('📨 Dữ liệu tin nhắn:', messageData);

    const messageRef = await addDoc(collection(db, 'Messages'), messageData);
    console.log('✅ Tin nhắn đã gửi, ID:', messageRef.id);

    // Cập nhật conversation và bỏ đánh dấu isNewFriend
    await updateOrCreateConversation(conversationId, user.uid, receiverId, content.trim());
    
    // CẬP NHẬT UNREAD COUNT CHO NGƯỜI NHẬN
    await updateUnreadCount(conversationId, receiverId);
    
    return { success: true, messageId: messageRef.id };
  } catch (error: any) {
    console.error('❌ Lỗi gửi tin nhắn:', error);
    return { 
      success: false, 
      error: error.message || 'Không thể gửi tin nhắn' 
    };
  }
};

// 🛠️ SỬA HÀM getMessages - THÊM THEO DÕI TRẠNG THÁI
export const getMessages = (
  conversationId: string, 
  callback: (Messages: Message[]) => void
) => {
  try {
    const user = checkFirebaseConnection();
    
    if (!conversationId) {
      console.error('❌ Conversation ID không hợp lệ');
      callback([]);
      return () => {};
    }

    const MessagesRef = collection(db, 'Messages');
    const q = query(
      MessagesRef,
      where('conversationId', '==', conversationId)
    );

    console.log('🔄 Lắng nghe Messages cho conversation:', conversationId);

    const unsubscribe = onSnapshot(q, 
      async (snapshot) => {
        try {
          const MessagesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Message[];
          
          MessagesData.sort((a, b) => {
            const timeA = a.timestamp?.toDate?.() || new Date(0);
            const timeB = b.timestamp?.toDate?.() || new Date(0);
            return timeA.getTime() - timeB.getTime();
          });
          
          console.log(`📨 Nhận ${MessagesData.length} Messages`);
          
          // 🆕 TỰ ĐỘNG ĐÁNH DẤU TIN NHẮN ĐÃ GIAO KHI NGƯỜI NHẬN MỞ CHAT
          const receivedMessages = MessagesData.filter(msg => 
            msg.receiverId === user.uid && !msg.delivered
          );
          
          if (receivedMessages.length > 0) {
            await markMessagesAsDelivered(conversationId, user.uid);
          }
          
          callback(MessagesData);
        } catch (error) {
          console.error('❌ Lỗi xử lý Messages:', error);
          callback([]);
        }
      },
      (error) => {
        console.error('❌ Lỗi lắng nghe Messages:', error);
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error: any) {
    console.error('❌ Lỗi khởi tạo lắng nghe Messages:', error);
    callback([]);
    return () => {};
  }
};

// 🆕 HÀM: Lấy trạng thái hiển thị cho tin nhắn
export const getMessagestatus = (message: Message, currentUserId: string): string => {
  if (message.senderId !== currentUserId) {
    return ''; // Tin nhắn của người khác không hiển thị trạng thái
  }
  
  switch (message.status) {
    case 'sent':
      return 'Đã gửi';
    case 'delivered':
      return 'Đã nhận';
    case 'read':
      return 'Đã xem';
    default:
      return 'Đã gửi';
  }
};

// 🆕 HÀM: Lấy icon trạng thái cho tin nhắn
export const getMessagestatusIcon = (message: Message, currentUserId: string): string => {
  if (message.senderId !== currentUserId) {
    return ''; // Tin nhắn của người khác không hiển thị icon
  }
  
  switch (message.status) {
    case 'sent':
      return '✓';
    case 'delivered':
      return '✓✓';
    case 'read':
      return '👁️';
    default:
      return '✓';
  }
};

// CÁC HÀM KHÁC GIỮ NGUYÊN...
export const getFriendsList = async (userId: string): Promise<any[]> => {
  try {
    console.log('🔄 Lấy danh sách bạn bè cho user:', userId);
    
    const friendsRef = collection(db, 'friends');
    const q = query(
      friendsRef,
      where('participants', 'array-contains', userId),
      where('status', '==', 'accepted')
    );
    
    const snapshot = await getDocs(q);
    const friends: any[] = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const participants = data.participants || [];
      const friendId = participants.find((id: string) => id !== userId);
      
      if (friendId) {
        try {
          const userRef = doc(db, 'users', friendId);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            friends.push({
              id: friendId,
              email: userData.email || 'Unknown',
              name: userData.name || userData.email?.split('@')[0] || 'User',
              friendshipId: docSnap.id,
              createdAt: data.createdAt
            });
          }
        } catch (error) {
          console.error('❌ Lỗi loading friend info:', error);
        }
      }
    }
    
    console.log('✅ Danh sách bạn bè:', friends.length);
    return friends;
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách bạn bè:', error);
    return [];
  }
};

export const getOrCreateConversationId = async (user1Id: string, user2Id: string): Promise<string> => {
  try {
    const participants = [user1Id, user2Id].sort();
    const conversationId = participants.join('_');
    
    console.log('🔄 Tạo/kiểm tra conversation:', conversationId);
    
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);
    
    if (!conversationSnap.exists()) {
      await setDoc(conversationRef, {
        id: conversationId,
        participants,
        lastMessage: '👋 Đã trở thành bạn bè. Hãy bắt đầu trò chuyện!',
        lastMessageTime: serverTimestamp(),
        unreadCount: 0,
        isNewFriend: true,
        createdAt: serverTimestamp()
      });
      console.log('✅ Đã tạo conversation mới:', conversationId);
    } else {
      console.log('✅ Conversation đã tồn tại:', conversationId);
    }
    
    return conversationId;
  } catch (error: any) {
    console.error('❌ Lỗi tạo conversation:', error);
    throw new Error(`Không thể tạo conversation: ${error.message}`);
  }
};

export const updateUnreadCount = async (conversationId: string, userId: string) => {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);
    
    if (conversationSnap.exists()) {
      const data = conversationSnap.data();
      const currentUnreadCount = data.unreadCount || 0;
      
      await updateDoc(conversationRef, {
        unreadCount: currentUnreadCount + 1
      });
      
      console.log('✅ Đã cập nhật unread count:', conversationId);
    }
  } catch (error) {
    console.error('❌ Lỗi cập nhật unread count:', error);
  }
};

export const resetUnreadCount = async (conversationId: string) => {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      unreadCount: 0
    });
    console.log('✅ Đã reset unread count:', conversationId);
  } catch (error) {
    console.error('❌ Lỗi reset unread count:', error);
  }
};

export const getCombinedConversations = (
  userId: string, 
  callback: (conversationsData: Conversation[]) => void
) => {
  try {
    const user = checkFirebaseConnection();
    
    console.log('🔄 Bắt đầu lắng nghe conversations...');
    
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId)
    );

    console.log('📡 Đang lắng nghe conversations...');

    const unsubscribe = onSnapshot(q, 
      async (snapshot) => {
        try {
          console.log(`📨 Nhận ${snapshot.docs.length} conversations từ Firestore`);
          
          const conversationsData: Conversation[] = [];
          
          for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const participants = data.participants || [];
            const otherUserId = participants.find((id: string) => id !== userId);
            
            if (otherUserId) {
              try {
                const userRef = doc(db, 'users', otherUserId);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                  const userData = userSnap.data();
                  conversationsData.push({
                    id: docSnap.id,
                    participants,
                    lastMessage: data.lastMessage || '👋 Đã trở thành bạn bè. Hãy bắt đầu trò chuyện!',
                    lastMessageTime: data.lastMessageTime || serverTimestamp(),
                    unreadCount: data.unreadCount || 0,
                    otherUser: {
                      id: otherUserId,
                      email: userData.email || 'Unknown',
                      name: userData.name || userData.email?.split('@')[0] || 'User'
                    },
                    isNewFriend: data.isNewFriend || false
                  });
                }
              } catch (error) {
                console.error('❌ Lỗi loading user:', error);
              }
            }
          }
          
          try {
            const friends = await getFriendsList(userId);
            const existingFriendIds = new Set(conversationsData.map(conv => 
              conv.otherUser?.id
            ).filter(Boolean));

            for (const friend of friends) {
              if (!existingFriendIds.has(friend.id)) {
                try {
                  const conversationId = await getOrCreateConversationId(userId, friend.id);
                  console.log('✅ Đã tạo conversation cho bạn bè:', friend.email);
                } catch (error) {
                  console.error('❌ Lỗi tạo conversation cho bạn bè:', error);
                }
              }
            }
          } catch (error) {
            console.error('❌ Lỗi xử lý bạn bè:', error);
          }
          
          conversationsData.sort((a, b) => {
            const timeA = a.lastMessageTime?.toDate?.() || new Date(0);
            const timeB = b.lastMessageTime?.toDate?.() || new Date(0);
            return timeB.getTime() - timeA.getTime();
          });

          console.log('✅ Tổng số conversations:', conversationsData.length);
          callback(conversationsData);
        } catch (error) {
          console.error('❌ Lỗi xử lý conversations:', error);
          callback([]);
        }
      },
      (error) => {
        console.error('❌ Lỗi lắng nghe conversations:', error);
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error: any) {
    console.error('❌ Lỗi khởi tạo lắng nghe conversations:', error);
    callback([]);
    return () => {};
  }
};

export const getConversations = (
  userId: string, 
  callback: (conversationsData: Conversation[]) => void
) => {
  try {
    const user = checkFirebaseConnection();
    
    console.log('🔄 Lắng nghe conversations đơn giản...');
    
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId)
    );

    const unsubscribe = onSnapshot(q, 
      async (snapshot) => {
        try {
          console.log(`📨 Nhận ${snapshot.docs.length} conversations`);
          
          const conversationsData: Conversation[] = [];
          
          for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const participants = data.participants || [];
            const otherUserId = participants.find((id: string) => id !== userId);
            
            if (otherUserId) {
              try {
                const userRef = doc(db, 'users', otherUserId);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                  const userData = userSnap.data();
                  conversationsData.push({
                    id: docSnap.id,
                    participants,
                    lastMessage: data.lastMessage || '👋 Đã trở thành bạn bè. Hãy bắt đầu trò chuyện!',
                    lastMessageTime: data.lastMessageTime,
                    unreadCount: data.unreadCount || 0,
                    otherUser: {
                      id: otherUserId,
                      email: userData.email || 'Unknown',
                      name: userData.name || userData.email?.split('@')[0] || 'User'
                    },
                    isNewFriend: data.isNewFriend || false
                  });
                }
              } catch (error) {
                console.error('❌ Lỗi loading user:', error);
              }
            }
          }
          
          conversationsData.sort((a, b) => {
            const timeA = a.lastMessageTime?.toDate?.() || new Date(0);
            const timeB = b.lastMessageTime?.toDate?.() || new Date(0);
            return timeB.getTime() - timeA.getTime();
          });

          console.log('✅ Conversations data:', conversationsData.length);
          callback(conversationsData);
        } catch (error) {
          console.error('❌ Lỗi xử lý conversations:', error);
          callback([]);
        }
      },
      (error) => {
        console.error('❌ Lỗi lắng nghe conversations:', error);
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error: any) {
    console.error('❌ Lỗi khởi tạo lắng nghe conversations:', error);
    callback([]);
    return () => {};
  }
};

export const updateOrCreateConversation = async (
  conversationId: string, 
  participant1: string, 
  participant2: string, 
  lastMessage: string
) => {
  try {
    console.log('🔄 Cập nhật conversation...', conversationId);
    
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationData = {
      id: conversationId,
      participants: [participant1, participant2],
      lastMessage: lastMessage,
      lastMessageTime: serverTimestamp(),
      unreadCount: 0,
      isNewFriend: false,
      updatedAt: serverTimestamp()
    };

    console.log('💾 Dữ liệu conversation:', conversationData);
    
    await setDoc(conversationRef, conversationData, { merge: true });
    console.log('✅ Conversation đã cập nhật');
    
    return true;
  } catch (error: any) {
    console.error('❌ Lỗi cập nhật conversation:', error);
    throw new Error(`Không thể cập nhật conversation: ${error.message}`);
  }
};

export const searchConversationsAndMessages = async (
  userId: string, 
  searchText: string
): Promise<Conversation[]> => {
  try {
    checkFirebaseConnection();
    
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId)
    );
    
    const snapshot = await getDocs(q);
    const allConversations: Conversation[] = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const participants = data.participants || [];
      const otherUserId = participants.find((id: string) => id !== userId);
      
      if (otherUserId) {
        try {
          const userRef = doc(db, 'users', otherUserId);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const userEmail = userData.email || '';
            const userName = userData.name || userEmail.split('@')[0] || 'User';
            
            if (userEmail.toLowerCase().includes(searchText.toLowerCase()) || 
                userName.toLowerCase().includes(searchText.toLowerCase()) ||
                data.lastMessage?.toLowerCase().includes(searchText.toLowerCase())) {
              allConversations.push({
                id: docSnap.id,
                participants,
                lastMessage: data.lastMessage || '👋 Đã trở thành bạn bè. Hãy bắt đầu trò chuyện!',
                lastMessageTime: data.lastMessageTime,
                unreadCount: data.unreadCount || 0,
                otherUser: { id: otherUserId, email: userEmail, name: userName },
                isNewFriend: data.isNewFriend || false
              });
            }
          }
        } catch (error) {
          console.error('❌ Lỗi loading user khi tìm kiếm:', error);
        }
      }
    }
    
    return allConversations;
  } catch (error) {
    console.error('❌ Lỗi tìm kiếm:', error);
    return [];
  }
};

export const deleteConversation = async (conversationId: string) => {
  try {
    checkFirebaseConnection();
    
    await deleteDoc(doc(db, 'conversations', conversationId));
    console.log('✅ Đã xóa conversation:', conversationId);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Lỗi xóa conversation:', error);
    return { success: false, error: error.message };
  }
};

export const getUnreadCount = async (conversationId: string, userId: string): Promise<number> => {
  try {
    const MessagesRef = collection(db, 'Messages');
    const q = query(
      MessagesRef,
      where('conversationId', '==', conversationId),
      where('receiverId', '==', userId),
      where('read', '==', false)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('❌ Lỗi lấy số tin nhắn chưa đọc:', error);
    return 0;
  }
};

export const getTotalUnreadCount = async (userId: string): Promise<number> => {
  try {
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId)
    );
    
    const snapshot = await getDocs(q);
    let totalUnread = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      totalUnread += data.unreadCount || 0;
    });
    
    return totalUnread;
  } catch (error) {
    console.error('❌ Lỗi lấy tổng số tin nhắn chưa đọc:', error);
    return 0;
  }
};

export const initializeAllFriendConversations = async (userId: string): Promise<void> => {
  try {
    console.log('🔄 Khởi tạo conversations cho tất cả bạn bè...');
    const friends = await getFriendsList(userId);
    
    for (const friend of friends) {
      try {
        await getOrCreateConversationId(userId, friend.id);
        console.log(`✅ Đã tạo conversation với: ${friend.email}`);
      } catch (error) {
        console.error(`❌ Lỗi tạo conversation với ${friend.email}:`, error);
      }
    }
    
    console.log('✅ Đã khởi tạo conversations cho tất cả bạn bè');
  } catch (error) {
    console.error('❌ Lỗi khởi tạo conversations:', error);
  }
};

export const ensureConversationExists = async (user1Id: string, user2Id: string): Promise<string> => {
  try {
    return await getOrCreateConversationId(user1Id, user2Id);
  } catch (error) {
    console.error('❌ Lỗi đảm bảo conversation tồn tại:', error);
    throw error;
  }
};