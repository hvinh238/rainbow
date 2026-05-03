import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth } from '../firebase';
import { logout } from '../utils/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [bankConnected, setBankConnected] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return unsubscribe;
  }, []);

  useEffect(() => {
    try {
      const status = localStorage?.getItem?.('bankConnected');
      setBankConnected(status === 'true');
    } catch {}
  }, []);

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            setTimeout(() => router.replace('/login'), 500);
          } catch (error: any) {
            Alert.alert('Error', `Could not sign out: ${error.message}`);
          }
        },
      },
    ]);
  };

  const handleResendVerification = async () => {
    if (!user) return;
    try {
      const { sendEmailVerification } = await import('firebase/auth');
      await sendEmailVerification(user);
      Alert.alert('Sent', 'Verification email has been resent.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const connectBank = () => {
    setBankConnected(true);
    try { localStorage?.setItem?.('bankConnected', 'true'); } catch {}
    try { localStorage?.setItem?.('bankPromptSeen', 'true'); } catch {}
    Alert.alert('Bank Connected', 'Your bank account has been linked.');
  };

  const disconnectBank = () => {
    setBankConnected(false);
    try { localStorage?.removeItem?.('bankConnected'); } catch {}
    Alert.alert('Disconnected', 'Bank account has been disconnected.');
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🔐</Text>
          <Text style={styles.emptyText}>Not signed in</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Avatar & Name */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.displayName}>{user.displayName || 'MoneyMeow User'}</Text>
        <Text style={styles.emailText}>{user.email}</Text>
        {user.emailVerified ? (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        ) : (
          <View style={[styles.verifiedBadge, styles.unverifiedBadge]}>
            <Text style={[styles.verifiedText, styles.unverifiedText]}>Not Verified</Text>
          </View>
        )}
      </View>

      {/* Info Cards */}
      <View style={styles.infoSection}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Display Name</Text>
          <Text style={styles.infoValue}>{user.displayName || 'Not set'}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user.email}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>User ID</Text>
          <Text style={styles.infoValueSmall}>{user.uid}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Account Created</Text>
          <Text style={styles.infoValue}>
            {user.metadata?.creationTime
              ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })
              : 'Unknown'}
          </Text>
        </View>
      </View>

      {/* Bank Connection */}
      <View style={styles.bankSection}>
        <Text style={styles.bankSectionTitle}>🏦 Bank Connection</Text>
        {bankConnected ? (
          <View style={styles.bankConnectedCard}>
            <View style={styles.bankConnectedInfo}>
              <Text style={styles.bankConnectedLabel}>Status</Text>
              <Text style={styles.bankConnectedStatus}>Connected</Text>
            </View>
            <TouchableOpacity style={styles.disconnectButton} onPress={disconnectBank}>
              <Text style={styles.disconnectButtonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.bankDisconnectedCard}>
            <Text style={styles.bankDisconnectedText}>
              Connect your bank to auto-sync transactions
            </Text>
            <TouchableOpacity style={styles.connectButton} onPress={connectBank}>
              <Text style={styles.connectButtonText}>Connect Bank</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Actions - minimized to ~40% width */}
      <View style={styles.actionsSection}>
        {!user.emailVerified && (
          <TouchableOpacity style={styles.actionButton} onPress={handleResendVerification}>
            <Text style={styles.actionButtonIcon}>📧</Text>
            <Text style={styles.actionButtonText}>Resend Verify</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.actionButton, styles.signOutAction]} onPress={handleLogout}>
          <Text style={styles.actionButtonIcon}>🚪</Text>
          <Text style={[styles.actionButtonText, styles.signOutActionText]}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
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
  title: { fontSize: 24, fontWeight: 'bold', color: '#d63384' },
  headerSpacer: { width: 60 },

  avatarSection: { alignItems: 'center', paddingVertical: 32 },
  avatar: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#ff6b9d',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#ff6b9d', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8, marginBottom: 16,
  },
  avatarText: { fontSize: 36, fontWeight: 'bold', color: 'white' },
  displayName: { fontSize: 22, fontWeight: 'bold', color: '#d63384', marginBottom: 4 },
  emailText: { fontSize: 14, color: '#ff9ec6', marginBottom: 12 },
  verifiedBadge: {
    backgroundColor: '#e8f5e9', paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#a5d6a7',
  },
  unverifiedBadge: { backgroundColor: '#fff3e0', borderColor: '#ffcc80' },
  verifiedText: { fontSize: 12, fontWeight: '600', color: '#2e7d32' },
  unverifiedText: { color: '#e65100' },

  infoSection: { paddingHorizontal: 16 },
  infoCard: {
    backgroundColor: 'white', padding: 18, borderRadius: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#fff0f5',
    shadowColor: '#ff9ec6', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  infoLabel: {
    fontSize: 12, color: '#ff9ec6', fontWeight: '600', marginBottom: 4,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  infoValue: { fontSize: 16, color: '#d63384', fontWeight: '600' },
  infoValueSmall: {
    fontSize: 12, color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Bank section
  bankSection: { paddingHorizontal: 16, marginTop: 8 },
  bankSectionTitle: { fontSize: 16, fontWeight: '700', color: '#2980b9', marginBottom: 10 },
  bankConnectedCard: {
    backgroundColor: '#e8f5e9', padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: '#a5d6a7',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  bankConnectedInfo: { flex: 1 },
  bankConnectedLabel: { fontSize: 12, color: '#666', fontWeight: '500' },
  bankConnectedStatus: { fontSize: 16, fontWeight: '700', color: '#2e7d32', marginTop: 2 },
  disconnectButton: {
    backgroundColor: '#e74c3c', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
  },
  disconnectButtonText: { color: 'white', fontWeight: '700', fontSize: 12 },
  bankDisconnectedCard: {
    backgroundColor: '#f0f8ff', padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: '#d6eaf8',
  },
  bankDisconnectedText: { fontSize: 14, color: '#7f8c8d', marginBottom: 12 },
  connectButton: {
    backgroundColor: '#4facfe', paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 12, alignSelf: 'flex-start',
  },
  connectButtonText: { color: 'white', fontWeight: '700', fontSize: 14 },

  // Actions - minimized to ~40% width
  actionsSection: {
    paddingHorizontal: 16, marginTop: 20,
    flexDirection: 'row', justifyContent: 'space-around',
  },
  actionButton: {
    width: '40%',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ffe6ee',
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  actionButtonIcon: { fontSize: 16, marginRight: 6 },
  actionButtonText: { color: '#ff6b9d', fontWeight: '700', fontSize: 14 },
  signOutAction: { borderColor: '#ff6b9d' },
  signOutActionText: { color: '#ff6b9d' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 18, color: '#ff6b9d', fontWeight: '600' },
  bottomSpacer: { height: 40 },
});
