import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { login } from '../utils/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      setWelcomeMsg(`🎉 Chào mừng trở lại!\n${email}`);
      setModalVisible(true);
      setTimeout(() => {
        setModalVisible(false);
        router.replace('/');
      }, 2000);
    } catch (error) {
      const errorMessage = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message)
        : 'Đã xảy ra lỗi khi đăng nhập';
      Alert.alert('❌ Lỗi đăng nhập', errorMessage);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>💖</Text>
        <Text style={styles.title}>MoneyMeow</Text>
        <Text style={styles.subtitle}>Quản lý tài chính thông minh</Text>
      </View>

      {/* Form đăng nhập */}
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>Đăng nhập</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#ff9ec6"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu"
          placeholderTextColor="#ff9ec6"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleLogin} 
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? '🔄 Đang đăng nhập...' : '🚀 Đăng nhập'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.signupLink} 
          onPress={() => router.push('/signup')}
        >
          <Text style={styles.signupText}>
            Chưa có tài khoản? <Text style={styles.signupHighlight}>Đăng ký ngay</Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal Chào mừng */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalIcon}>🎉</Text>
            <Text style={styles.modalText}>{welcomeMsg}</Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fffafc" 
  },
  header: {
    alignItems: "center",
    paddingTop: 80,
    paddingBottom: 40,
    backgroundColor: '#fff0f5',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    marginBottom: 20,
  },
  logo: {
    fontSize: 50,
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#d63384",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#ff6b9d",
    fontWeight: '500',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 30,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#d63384",
    textAlign: "center",
    marginBottom: 30,
  },
  input: {
    borderWidth: 2,
    borderColor: '#ffe6ee',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
    color: '#d63384',
    marginBottom: 16,
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  button: {
    backgroundColor: '#ff6b9d',
    padding: 18,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
  },
  signupLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  signupText: {
    color: '#ff6b9d',
    fontSize: 14,
  },
  signupHighlight: {
    fontWeight: 'bold',
    color: '#d63384',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff0f5',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffd6e7',
  },
  modalIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    color: '#d63384',
    fontWeight: '600',
    textAlign: 'center',
  },
});
