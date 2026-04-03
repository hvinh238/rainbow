import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { auth } from '../firebase';
import {
    Conversation,
    deleteConversation,
    getConversations,
    getMessages,
    Message,
    sendMessage
} from '../utils/messageUtils';

export default function MessagesScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State cho chat modal
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageUnsubscribe, setMessageUnsubscribe] = useState<(() => void) | null>(null);

  // Load conversations
  useEffect(() => {
    console.log('🎯 Bắt đầu load conversations...');
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ User chưa đăng nhập');
      setLoading(false);
      return;
    }

    console.log('👤 User đã đăng nhập:', user.uid);

    const unsubscribe = getConversations(user.uid, (conversationsData: Conversation[]) => {
      console.log('📥 Nhận conversations data:', conversationsData);
      setConversations(conversationsData);
      setLoading(false);
    });

    return () => {
      console.log('🧹 Dọn dẹp conversations listener');
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Mở chat modal
  const openChat = async (conversation: Conversation) => {
    try {
      console.log('🎯 Bắt đầu mở chat...', conversation);
      
      const user = auth.currentUser;
      if (!user || !conversation.otherUser) {
        Alert.alert('Lỗi', 'Không thể mở chat');
        return;
      }

      console.log('👥 User info:', {
        currentUser: user.uid,
        otherUser: conversation.otherUser.id
      });

      setSelectedConversation(conversation);
      setChatModalVisible(true);
      
      // Dọn dẹp listener cũ nếu có
      if (messageUnsubscribe) {
        messageUnsubscribe();
      }

      // Load messages cho conversation này
      console.log('🔄 Lắng nghe messages cho conversation:', conversation.id);
      const unsubscribe = getMessages(conversation.id, (messages: Message[]) => {
        console.log('📥 Nhận messages:', messages.length);
        setChatMessages(messages);
      });

      setMessageUnsubscribe(() => unsubscribe);
    } catch (error: any) {
      console.error('❌ Lỗi mở chat:', error);
      Alert.alert('Lỗi', error.message || 'Không thể mở cuộc trò chuyện');
    }
  };

  // Đóng chat modal
  const closeChatModal = () => {
    console.log('🚪 Đóng chat modal');
    if (messageUnsubscribe) {
      messageUnsubscribe();
      setMessageUnsubscribe(null);
    }
    setChatModalVisible(false);
    setSelectedConversation(null);
    setChatMessages([]);
    setNewMessage('');
  };

  // Gửi tin nhắn
  const handleSendMessage = async () => {
    console.log('🎯 Bắt đầu gửi tin nhắn...');
    console.log('Selected Conversation:', selectedConversation);
    console.log('New Message:', newMessage);
    console.log('Current User:', auth.currentUser?.uid);

    if (!newMessage.trim() || !selectedConversation || !auth.currentUser) {
      console.log('❌ Thiếu dữ liệu để gửi tin nhắn');
      Alert.alert('Lỗi', 'Vui lòng nhập nội dung tin nhắn');
      return;
    }

    if (!selectedConversation.otherUser) {
      console.log('❌ Thiếu thông tin người nhận');
      Alert.alert('Lỗi', 'Không tìm thấy thông tin người nhận');
      return;
    }

    setSendingMessage(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      console.log('🔄 Gọi hàm sendMessage...');
      const result = await sendMessage(
        selectedConversation.id,
        auth.currentUser.uid,
        selectedConversation.otherUser.id,
        messageContent
      );

      console.log('📩 Kết quả gửi tin nhắn:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }

      console.log('✅ Gửi tin nhắn thành công');
      
    } catch (error: any) {
      console.error('❌ Lỗi gửi tin nhắn:', error);
      Alert.alert('Lỗi', error.message || 'Không thể gửi tin nhắn!');
      setNewMessage(messageContent);
    } finally {
      setSendingMessage(false);
    }
  };

  // Xóa conversation
  const deleteConversationHandler = (conversationId: string) => {
    Alert.alert(
      'Xóa cuộc trò chuyện',
      'Bạn có chắc muốn xóa cuộc trò chuyện này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteConversation(conversationId);
              if (result.success) {
                Alert.alert('Thành công', 'Đã xóa cuộc trò chuyện');
                // Cập nhật UI ngay lập tức
                setConversations(prev => prev.filter(conv => conv.id !== conversationId));
              } else {
                Alert.alert('Lỗi', result.error || 'Không thể xóa cuộc trò chuyện');
              }
            } catch (error: any) {
              Alert.alert('Lỗi', error.message || 'Không thể xóa cuộc trò chuyện');
            }
          },
        },
      ]
    );
  };

  // Format thời gian
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate();
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
      
      if (diffInHours < 24) {
        return date.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit'
        });
      } else {
        return date.toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit'
        });
      }
    } catch (error) {
      return '';
    }
  };

  // Render conversation item
  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity 
      style={[
        styles.conversationItem,
        item.isNewFriend && styles.newFriendItem,
      ]}
      onPress={() => openChat(item)}
      onLongPress={() => deleteConversationHandler(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.otherUser?.email?.charAt(0).toUpperCase() || 'U'}
        </Text>
        {item.isNewFriend && (
          <View style={styles.newFriendBadge}>
            <Text style={styles.newFriendBadgeText}>Mới</Text>
          </View>
        )}
      </View>
      
      <View style={styles.conversationInfo}>
        <View style={styles.conversationHeader}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.otherUser?.email || 'Unknown User'}
          </Text>
          <Text style={styles.timeText}>
            {formatTime(item.lastMessageTime)}
          </Text>
        </View>
        <Text 
          style={[
            styles.lastMessage,
            item.isNewFriend && styles.newFriendMessage,
          ]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {item.lastMessage}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Render chat message
  const renderChatMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderId === auth.currentUser?.uid;
    
    return (
      <View style={[
        styles.chatMessageContainer,
        isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer
      ]}>
        <View style={[
          styles.chatMessageBubble,
          isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble
        ]}>
          <Text style={[
            styles.chatMessageText,
            isMyMessage ? styles.myMessageText : styles.theirMessageText
          ]}>
            {item.content}
          </Text>
          <Text style={[
            styles.chatTimeText,
            isMyMessage ? styles.myTimeText : styles.theirTimeText
          ]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar backgroundColor="#fff0f5" barStyle="dark-content" />
        <ActivityIndicator size="large" color="#ff6b9d" />
        <Text style={styles.loadingText}>Đang tải tin nhắn...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#fff0f5" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>💬 Tin Nhắn</Text>
        </View>
        <Text style={styles.subtitle}>
          {conversations.length} cuộc trò chuyện
        </Text>
      </View>

      {/* Conversations List */}
      {conversations.length > 0 ? (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          style={styles.conversationsList}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyText}>
            Hiện tại không có tin nhắn
          </Text>
          <Text style={styles.emptySubText}>
            Hãy kết bạn và bắt đầu trò chuyện!
          </Text>
          <TouchableOpacity 
            style={styles.findFriendsButton}
            onPress={() => router.push('/AddFriends')}
          >
            <Text style={styles.findFriendsButtonText}>👥 Tìm bạn bè</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CHAT MODAL */}
      <Modal
        visible={chatModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeChatModal}
      >
        <KeyboardAvoidingView 
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Chat Header */}
          <View style={styles.chatHeader}>
            <TouchableOpacity 
              onPress={closeChatModal}
              style={styles.chatBackButton}
            >
              <Text style={styles.chatBackButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.chatTitle}>
              {selectedConversation?.otherUser?.email || 'Chat'}
            </Text>
            <View style={styles.chatHeaderSpacer} />
          </View>

          {/* Messages List */}
          <FlatList
            data={chatMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderChatMessage}
            style={styles.chatMessagesList}
            contentContainerStyle={styles.chatMessagesContent}
            showsVerticalScrollIndicator={false}
            ref={ref => {
              if (ref && chatMessages.length > 0) {
                setTimeout(() => ref.scrollToEnd({ animated: true }), 100);
              }
            }}
          />

          {/* Input Area */}
          <View style={styles.chatInputContainer}>
            <TextInput
              style={styles.chatTextInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder={
                selectedConversation?.isNewFriend 
                  ? "Gửi lời chào đến bạn mới..." 
                  : "Nhập tin nhắn..."
              }
              placeholderTextColor="#999"
              multiline
              maxLength={1000}
            />
            <TouchableOpacity 
              style={[
                styles.chatSendButton,
                (!newMessage.trim() || sendingMessage) && styles.chatSendButtonDisabled
              ]} 
              onPress={handleSendMessage}
              disabled={!newMessage.trim() || sendingMessage}
            >
              <Text style={styles.chatSendButtonText}>
                {sendingMessage ? '⏳' : '➤'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fffafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff0f5',
    padding: 24,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 1,
  },
  backButtonText: {
    fontSize: 24,
    color: '#d63384',
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d63384',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#ff9ec6',
    fontWeight: '500',
  },
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff0f5',
    alignItems: 'center',
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  newFriendItem: {
    backgroundColor: '#f0f8ff',
    borderColor: '#e1f5fe',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ff6b9d',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  newFriendBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ff6b9d',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  newFriendBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  conversationInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  newFriendMessage: {
    color: '#ff6b9d',
    fontStyle: 'italic',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#d63384',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: '#ff9ec6',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  findFriendsButton: {
    backgroundColor: '#ff6b9d',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  findFriendsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Chat Modal Styles
  chatContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff0f5',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#ffe6ee',
  },
  chatBackButton: {
    padding: 8,
  },
  chatBackButtonText: {
    fontSize: 20,
    color: '#d63384',
    fontWeight: 'bold',
  },
  chatTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d63384',
    textAlign: 'center',
  },
  chatHeaderSpacer: {
    width: 40,
  },
  chatMessagesList: {
    flex: 1,
  },
  chatMessagesContent: {
    padding: 16,
  },
  chatMessageContainer: {
    marginBottom: 12,
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  theirMessageContainer: {
    alignItems: 'flex-start',
  },
  chatMessageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  myMessageBubble: {
    backgroundColor: '#ff6b9d',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#ffe6ee',
  },
  chatMessageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#333',
  },
  chatTimeText: {
    fontSize: 10,
    marginTop: 4,
    opacity: 0.7,
  },
  myTimeText: {
    color: '#fff',
    textAlign: 'right',
  },
  theirTimeText: {
    color: '#666',
  },
  chatInputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ffe6ee',
    alignItems: 'flex-end',
  },
  chatTextInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#ffe6ee',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    maxHeight: 100,
    color: '#333',
  },
  chatSendButton: {
    backgroundColor: '#ff6b9d',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  chatSendButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
  },
  chatSendButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
