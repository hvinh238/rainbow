import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const BOT_RESPONSES: Record<string, string> = {
  'password': 'To reset your password, go to the Login page and tap "Forgot Password". You will receive a reset email within minutes.',
  'verify': 'To verify your email, go to Profile > Resend Verification. Check your inbox and spam folder.',
  'bank': 'To connect your bank, tap the bank notification on the home screen or go to Profile > Bank Connection > Connect Bank.',
  'transaction': 'To add a transaction, tap the + button on the home screen. Fill in amount, category, type, and save.',
  'friend': 'To add friends, open the menu > Ket Ban, then search by email and send a friend request.',
  'group': 'To create a group fund, open the menu > Quy Chung, then fill in the fund name, target amount, and invite friends.',
  'heo': 'Heo Dat (Piggy Bank) lets you save toward goals. Open menu > Heo Dat to create savings goals and deposit money.',
  'export': 'To export transactions, open menu > Xuat Excel. A CSV file will be downloaded to your device.',
  'delete': 'To delete a transaction, tap on it to open the edit screen, then tap the delete button at the bottom.',
  'sign out': 'To sign out, go to Profile and tap the Sign Out button.',
  'chat': 'To message a friend, open menu > Tin Nhan, then tap on a conversation to start chatting.',
  'hello': 'Hello! I am MoneyMeow Support Bot. How can I help you today? You can ask about passwords, verification, bank connection, transactions, friends, group funds, or contact our staff.',
  'hi': 'Hi there! I am MoneyMeow Support Bot. How can I help you? Ask about any feature or type "call" or "email" to contact staff.',
};

function getBotResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  for (const [key, response] of Object.entries(BOT_RESPONSES)) {
    if (lower.includes(key)) return response;
  }
  if (lower.includes('call') || lower.includes('phone') || lower.includes('hotline')) {
    return 'Our hotline is available 24/7:\n📞 1900-MEOW (1900-6369)\n\nMon-Fri: 8:00 - 20:00\nSat-Sun: 9:00 - 17:00';
  }
  if (lower.includes('email') || lower.includes('mail') || lower.includes('staff')) {
    return 'You can email our support team:\n📧 support@moneymeow.app\n\nWe typically respond within 24 hours.';
  }
  if (lower.includes('thank')) {
    return 'You are welcome! Is there anything else I can help with?';
  }
  return 'I am not sure about that. Try asking about: password, verify, bank, transaction, friend, group, heo dat, export, or type "call" / "email" to contact our staff directly.';
}

export default function CSKHScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: 'Hello! I am MoneyMeow Support Bot. How can I help you?\n\nYou can ask about:\n- Password reset\n- Email verification\n- Bank connection\n- Transactions\n- Friends & Chat\n- Group Funds\n\nOr type "call" or "email" to contact our staff.',
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const sendMessage = () => {
    if (!inputText.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    setTimeout(() => {
      const botResponse = getBotResponse(userMsg.text);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
    }, 600);
  };

  useEffect(() => {
    setTimeout(() => scrollViewRef.current?.scrollToEnd?.({ animated: true }), 100);
  }, [messages]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>🎧 CSKH</Text>
          <Text style={styles.subtitle}>Customer Support</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickButton} onPress={() => {
          const msg = 'I want to call staff';
          setInputText(msg);
          setTimeout(() => { setInputText(''); setMessages(prev => [...prev, { id: Date.now().toString(), text: msg, sender: 'user', timestamp: new Date() }]); setTimeout(() => { setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: getBotResponse('call'), sender: 'bot', timestamp: new Date() }]); }, 600); }, 100);
        }}>
          <Text style={styles.quickButtonIcon}>📞</Text>
          <Text style={styles.quickButtonText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickButton} onPress={() => {
          const msg = 'I want to email staff';
          setInputText(msg);
          setTimeout(() => { setInputText(''); setMessages(prev => [...prev, { id: Date.now().toString(), text: msg, sender: 'user', timestamp: new Date() }]); setTimeout(() => { setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: getBotResponse('email'), sender: 'bot', timestamp: new Date() }]); }, 600); }, 100);
        }}>
          <Text style={styles.quickButtonIcon}>📧</Text>
          <Text style={styles.quickButtonText}>Email</Text>
        </TouchableOpacity>
      </View>

      {/* Chat Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[styles.messageBubble, msg.sender === 'user' ? styles.userBubble : styles.botBubble]}
          >
            {msg.sender === 'bot' && <Text style={styles.botLabel}>🤖 Bot</Text>}
            <Text style={[styles.messageText, msg.sender === 'user' ? styles.userText : styles.botText]}>
              {msg.text}
            </Text>
            <Text style={[styles.timeText, msg.sender === 'user' ? styles.userTime : styles.botTime]}>
              {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type your question..."
          placeholderTextColor="#bdc3c7"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fffafc' },
  header: {
    backgroundColor: '#fff0f5', padding: 24, paddingTop: 60,
    borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
    shadowColor: '#ff9ec6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: { fontSize: 18, color: '#d63384', fontWeight: 'bold' },
  headerCenter: { alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#d63384' },
  subtitle: { fontSize: 12, color: '#ff9ec6', fontWeight: '500' },
  headerSpacer: { width: 60 },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ffe6ee',
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickButtonIcon: { fontSize: 16, marginRight: 6 },
  quickButtonText: { fontSize: 13, fontWeight: '600', color: '#d63384' },

  // Chat area
  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 8 },
  messageBubble: {
    maxWidth: '80%',
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: '#ff6b9d',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: 'white',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#ffe6ee',
  },
  botLabel: { fontSize: 10, color: '#4facfe', fontWeight: '700', marginBottom: 4 },
  messageText: { fontSize: 15, lineHeight: 20 },
  userText: { color: 'white' },
  botText: { color: '#2c3e50' },
  timeText: { fontSize: 10, marginTop: 6, opacity: 0.6 },
  userTime: { color: 'white', textAlign: 'right' },
  botTime: { color: '#95a5a6' },

  // Input
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#ffe6ee',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#ffe6ee',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    fontSize: 15,
    backgroundColor: '#fffafc',
    color: '#2c3e50',
    maxHeight: 80,
  },
  sendButton: {
    backgroundColor: '#ff6b9d',
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sendButtonDisabled: { backgroundColor: '#ddd', shadowOpacity: 0 },
  sendButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});
