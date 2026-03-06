import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { signup } from '../utils/auth';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const router = useRouter();

  const handleSignup = async () => {
    if (!email || !password || !displayName) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Lỗi', 'Mật khẩu phải ít nhất 6 ký tự');
      return;
    }

    setLoading(true);
    try {
      await signup(email, password, displayName);
      setConfirmMsg(`🎉 Tài khoản đã tạo thành công!\n${email}`);
      setModalVisible(true);
      setTimeout(() => {
        setModalVisible(false);
        router.back();
      }, 2000);
    } catch (error) {
      const errorMsg = typeof error === 'object' && error !== null && 'message' in error
        ? (error as { message: string }).message
        : 'Đã xảy ra lỗi khi tạo tài khoản';
      Alert.alert('❌ Lỗi đăng ký', errorMsg);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>💖</Text>
          <Text style={styles.title}>MoneyMeow</Text>
          <Text style={styles.subtitle}>Bắt đầu hành trình tài chính</Text>
        </View>

        {/* Form đăng ký */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Tạo tài khoản</Text>
          
          <TextInput 
            style={styles.input} 
            placeholder="Tên hiển thị" 
            placeholderTextColor="#ff9ec6"
            value={displayName} 
            onChangeText={setDisplayName} 
          />
          
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
          
          <Text style={styles.passwordHint}>
            🔒 Mật khẩu phải có ít nhất 6 ký tự
          </Text>
          
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleSignup} 
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? '🔄 Đang tạo tài khoản...' : '🌟 Đăng ký ngay'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.loginLink} 
            onPress={() => router.back()}
          >
            <Text style={styles.loginText}>
              Đã có tài khoản? <Text style={styles.loginHighlight}>Đăng nhập</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal Xác nhận */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalIcon}>✅</Text>
            <Text style={styles.modalText}>{confirmMsg}</Text>
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
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 30,
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
    paddingBottom: 40,
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
  passwordHint: {
    fontSize: 12,
    color: '#ff6b9d',
    marginBottom: 16,
    textAlign: 'center',
    fontStyle: 'italic',
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
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginText: {
    color: '#ff6b9d',
    fontSize: 14,
  },
  loginHighlight: {
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