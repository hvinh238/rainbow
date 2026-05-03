<<<<<<< HEAD
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
  updateDoc
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebase";

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  createdAt?: any;
}

interface BankAccount {
  id: string;
  balance: number;
}

const HeoDat: React.FC = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [goalName, setGoalName] = useState("");
  const [goalAmount, setGoalAmount] = useState("");

  // 🔹 Lấy danh sách heo đất và tài khoản ngân hàng từ Firebase
  const loadData = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Lỗi", "Vui lòng đăng nhập!");
      return;
    }

    try {
      // Lấy danh sách heo đất
      const goalsRef = collection(db, "users", user.uid, "goals");
      const goalsSnapshot = await getDocs(goalsRef);
      const goalsData = goalsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        name: doc.data().name,
        targetAmount: doc.data().targetAmount || doc.data().amount || 0,
        currentAmount: doc.data().currentAmount || doc.data().current || 0,
        createdAt: doc.data().createdAt,
      })) as Goal[];
      setGoals(goalsData);

      // Lấy tài khoản ngân hàng
      const bankRef = collection(db, "users", user.uid, "bankAccount");
      const bankSnapshot = await getDocs(bankRef);
      
      if (bankSnapshot.empty) {
        // Tạo tài khoản ngân hàng mới nếu chưa có
        const newBankAccount = {
          balance: 0,
          createdAt: Timestamp.now(),
        };
        const bankDocRef = await addDoc(collection(db, "users", user.uid, "bankAccount"), newBankAccount);
        setBankAccount({ id: bankDocRef.id, balance: 0 });
      } else {
        const bankData = bankSnapshot.docs[0];
        setBankAccount({ 
          id: bankData.id, 
          balance: bankData.data().balance || 0 
        });
      }
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu:", error);
      Alert.alert("Lỗi", "Không thể tải dữ liệu!");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 🔹 Cập nhật số dư tài khoản ngân hàng
  const updateBankBalance = async (newBalance: number) => {
    const user = auth.currentUser;
    if (!user || !bankAccount) return;

    try {
      const bankRef = doc(db, "users", user.uid, "bankAccount", bankAccount.id);
      await updateDoc(bankRef, { balance: newBalance });
      setBankAccount({ ...bankAccount, balance: newBalance });
    } catch (error) {
      console.error("Lỗi khi cập nhật số dư:", error);
      Alert.alert("Lỗi", "Không thể cập nhật số dư!");
    }
  };

  // 🔹 Cập nhật heo đất
  const updateGoal = async (goalId: string, updates: any) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const goalRef = doc(db, "users", user.uid, "goals", goalId);
      await updateDoc(goalRef, updates);
    } catch (error) {
      console.error("Lỗi khi cập nhật heo đất:", error);
      Alert.alert("Lỗi", "Không thể cập nhật heo đất!");
    }
  };

  // 🔹 Thêm heo đất mới
  const createGoal = async () => {
    if (!goalName || !goalAmount) {
      return Alert.alert("Lỗi", "Vui lòng nhập tên và số tiền mục tiêu!");
    }

    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Lỗi", "Vui lòng đăng nhập!");
      return;
    }

    try {
      const goalsRef = collection(db, "users", user.uid, "goals");
      await addDoc(goalsRef, {
        name: goalName,
        targetAmount: Number(goalAmount),
        currentAmount: 0,
        createdAt: Timestamp.now(),
      });

      Alert.alert("Thành công", "Đã thêm heo đất mới!");
      setGoalName("");
      setGoalAmount("");
      loadData();
    } catch (error) {
      console.error("Lỗi khi thêm heo đất:", error);
      Alert.alert("Lỗi", "Không thể thêm heo đất!");
    }
  };

  // 🔹 Nạp tiền vào tài khoản ngân hàng
  const depositToBank = async (amount: number) => {
    if (amount <= 0) return Alert.alert("Lỗi", "Số tiền không hợp lệ!");
    
    if (!bankAccount) {
      Alert.alert("Lỗi", "Tài khoản ngân hàng chưa sẵn sàng!");
      return;
    }

    const newBalance = bankAccount.balance + amount;
    await updateBankBalance(newBalance);
    Alert.alert("Thành công", `Đã nạp ${amount.toLocaleString()}đ vào tài khoản!`);
  };

  // 🔹 Rút tiền từ tài khoản ngân hàng
  const withdrawFromBank = async (amount: number) => {
    if (amount <= 0) return Alert.alert("Lỗi", "Số tiền không hợp lệ!");
    
    if (!bankAccount) {
      Alert.alert("Lỗi", "Tài khoản ngân hàng chưa sẵn sàng!");
      return;
    }

    if (bankAccount.balance < amount) {
      return Alert.alert("Lỗi", "Không đủ tiền trong tài khoản ngân hàng!");
    }

    const newBalance = bankAccount.balance - amount;
    await updateBankBalance(newBalance);
    Alert.alert("Thành công", `Đã rút ${amount.toLocaleString()}đ từ tài khoản!`);
  };

  // 🔹 Nạp tiền vào heo đất (từ tài khoản ngân hàng)
  const depositToPiggy = async (goalIndex: number, amount: number) => {
    if (amount <= 0) return Alert.alert("Lỗi", "Số tiền không hợp lệ!");
    
    if (!bankAccount) {
      Alert.alert("Lỗi", "Tài khoản ngân hàng chưa sẵn sàng!");
      return;
    }

    if (bankAccount.balance < amount) {
      return Alert.alert("Lỗi", "Không đủ tiền trong tài khoản ngân hàng!");
    }

    const goal = goals[goalIndex];
    const newGoalAmount = goal.currentAmount + amount;
    const newBankBalance = bankAccount.balance - amount;

    try {
      // Cập nhật cả heo đất và tài khoản ngân hàng
      await Promise.all([
        updateGoal(goal.id, { currentAmount: newGoalAmount }),
        updateBankBalance(newBankBalance)
      ]);

      // Cập nhật UI
      const updatedGoals = [...goals];
      updatedGoals[goalIndex].currentAmount = newGoalAmount;
      setGoals(updatedGoals);

      Alert.alert("Thành công", `Đã nạp ${amount.toLocaleString()}đ vào heo đất "${goal.name}"!`);
    } catch (error) {
      Alert.alert("Lỗi", "Không thể nạp tiền vào heo đất!");
    }
  };

  // 🔹 Rút tiền ra khỏi heo đất (về tài khoản ngân hàng)
  const withdrawFromPiggy = async (goalIndex: number, amount: number) => {
    if (amount <= 0) return Alert.alert("Lỗi", "Số tiền không hợp lệ!");
    
    if (!bankAccount) {
      Alert.alert("Lỗi", "Tài khoản ngân hàng chưa sẵn sàng!");
      return;
    }

    const goal = goals[goalIndex];
    if (goal.currentAmount < amount) {
      return Alert.alert("Lỗi", "Không đủ tiền trong heo đất!");
    }

    const newGoalAmount = goal.currentAmount - amount;
    const newBankBalance = bankAccount.balance + amount;

    try {
      // Cập nhật cả heo đất và tài khoản ngân hàng
      await Promise.all([
        updateGoal(goal.id, { currentAmount: newGoalAmount }),
        updateBankBalance(newBankBalance)
      ]);

      // Cập nhật UI
      const updatedGoals = [...goals];
      updatedGoals[goalIndex].currentAmount = newGoalAmount;
      setGoals(updatedGoals);

      Alert.alert("Thành công", `Đã rút ${amount.toLocaleString()}đ từ heo đất "${goal.name}"!`);
    } catch (error) {
      Alert.alert("Lỗi", "Không thể rút tiền từ heo đất!");
    }
  };

  // 🔹 Xóa heo đất (chuyển tiền về tài khoản ngân hàng)
  const deleteGoal = async (goalIndex: number) => {
    const goal = goals[goalIndex];
    
    Alert.alert(
      "Xác nhận", 
      goal.currentAmount > 0 
        ? `Bạn có chắc muốn xóa heo đất "${goal.name}"?\n\nSố tiền ${goal.currentAmount.toLocaleString()}đ sẽ được chuyển về tài khoản ngân hàng.`
        : `Bạn có chắc muốn xóa heo đất "${goal.name}"?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            const user = auth.currentUser;
            if (!user || !bankAccount) return;

            try {
              // Chuyển tiền từ heo đất về tài khoản ngân hàng
              if (goal.currentAmount > 0) {
                const newBankBalance = bankAccount.balance + goal.currentAmount;
                await updateBankBalance(newBankBalance);
              }

              // Xóa heo đất
              const goalRef = doc(db, "users", user.uid, "goals", goal.id);
              await deleteDoc(goalRef);
              
              // Cập nhật UI
              const updatedGoals = goals.filter((_, i) => i !== goalIndex);
              setGoals(updatedGoals);
              
              Alert.alert(
                "Thành công", 
                goal.currentAmount > 0
                  ? `Đã xóa heo đất!\nSố tiền ${goal.currentAmount.toLocaleString()}đ đã được chuyển về tài khoản ngân hàng.`
                  : "Đã xóa heo đất!"
              );
            } catch (error) {
              console.error("Lỗi khi xóa heo đất:", error);
              Alert.alert("Lỗi", "Không thể xóa heo đất!");
            }
          },
        },
      ]
    );
  };

  // 🔹 Tính phần trăm tiết kiệm
  const getProgress = (goal: Goal) => {
    return goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🐷 Heo Đất Tiết Kiệm</Text>
        <Text style={styles.subtitle}>Quản lý mục tiêu tiết kiệm của bạn</Text>
      </View>

      {/* Tài khoản ngân hàng - MỘT TÀI KHOẢN DUY NHẤT */}
      <View style={styles.box}>
        <Text style={styles.sectionTitle}>💰 TÀI KHOẢN NGÂN HÀNG</Text>
        
        <View style={styles.bankBalanceContainer}>
          <Text style={styles.bankBalanceLabel}>Số dư khả dụng</Text>
          <Text style={styles.bankBalanceAmount}>
            {bankAccount ? bankAccount.balance.toLocaleString("vi-VN") : "0"} VND
          </Text>
        </View>

        <View style={styles.bankActions}>
          <View style={styles.bankActionColumn}>
            <Text style={styles.label}>💵 Nạp tiền vào tài khoản</Text>
            <ActionInput
              placeholder=""
              actionText="Nạp"
              onAction={(v) => depositToBank(v)}
            />
          </View>
          
          <View style={styles.bankActionColumn}>
            <Text style={styles.label}>💸 Rút tiền từ tài khoản</Text>
            <ActionInput
              placeholder=""
              actionText="Rút"
              onAction={(v) => withdrawFromBank(v)}
            />
          </View>
        </View>
      </View>

      {/* Form tạo mục tiêu */}
      <View style={styles.box}>
        <Text style={styles.sectionTitle}>📝 TẠO MỤC TIÊU MỚI</Text>
        <Text style={styles.label}>Tên mục tiêu</Text>
        <TextInput
          style={styles.input}
          placeholder="VD: Du lịch Đà Lạt..."
          placeholderTextColor="#ff9ec6"
          value={goalName}
          onChangeText={setGoalName}
        />
        <Text style={styles.label}>Số tiền cần tiết kiệm (VND)</Text>
        <TextInput
          style={styles.input}
          placeholder="VD: 5000000"
          placeholderTextColor="#ff9ec6"
          keyboardType="numeric"
          value={goalAmount}
          onChangeText={setGoalAmount}
        />
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={createGoal}
          disabled={!bankAccount}
        >
          <Text style={styles.addButtonText}>
            {bankAccount ? "➕ Thêm mục tiêu" : "⏳ Đang tải..."}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Danh sách heo đất */}
      {goals.map((goal, index) => (
        <View style={styles.box} key={goal.id}>
          <View style={styles.goalHeader}>
            <Text style={styles.goalTitle}>🎯 {goal.name}</Text>
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={() => deleteGoal(index)}
            >
              <Text style={styles.deleteText}>🗑️</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.info}>
            Đã tiết kiệm:{" "}
            <Text style={styles.amount}>{goal.currentAmount.toLocaleString("vi-VN")}</Text>{" "}
            /{" "}
            <Text style={styles.amount}>{goal.targetAmount.toLocaleString("vi-VN")}</Text> VND
          </Text>

          {/* Thanh tiến độ */}
          <View style={styles.progressBar}>
            <View style={[styles.progress, { width: `${getProgress(goal)}%` }]}>
              <Text style={styles.progressText}>
                {Math.floor(getProgress(goal))}%
              </Text>
            </View>
          </View>

          {/* Số dư tài khoản hiện tại (chỉ để tham khảo) */}
          <Text style={[styles.label, { marginTop: 15 }]}>
            💰 Số dư tài khoản hiện tại:{" "}
            <Text style={styles.amount}>
              {bankAccount ? bankAccount.balance.toLocaleString("vi-VN") : "0"} VND
            </Text>
          </Text>

          {/* Nạp tiền vào heo đất */}
          <Text style={styles.label}>🐷 Chuyển tiền vào heo đất</Text>
          <ActionInput
            placeholder="VD: 500000"
            actionText="Nạp"
            onAction={(v) => depositToPiggy(index, v)}
            disabled={!bankAccount}
          />

          {/* Rút tiền ra khỏi heo đất */}
          <Text style={styles.label}>💸 Rút tiền ra khỏi heo đất</Text>
          <ActionInput
            placeholder="VD: 200000"
            actionText="Rút"
            onAction={(v) => withdrawFromPiggy(index, v)}
            disabled={!bankAccount}
          />
        </View>
      ))}
    </ScrollView>
  );
};

// 🔹 Component con để nhập + nhấn nút nhanh
const ActionInput = ({
  placeholder,
  actionText,
  onAction,
  disabled = false,
}: {
  placeholder: string;
  actionText: string;
  onAction: (value: number) => void;
  disabled?: boolean;
}) => {
  const [value, setValue] = useState("");
  return (
    <View style={styles.row}>
      <TextInput
        style={[
          styles.input, 
          { flex: 1, marginRight: 10 },
          disabled && styles.disabledInput
        ]}
        placeholder={placeholder}
        placeholderTextColor="#ff9ec6"
        keyboardType="numeric"
        value={value}
        onChangeText={setValue}
        editable={!disabled}
      />
      <TouchableOpacity
        style={[
          styles.actionButton,
          actionText === "Rút" && styles.withdrawButton,
          disabled && styles.disabledButton
        ]}
        onPress={() => {
          if (disabled) return;
          const num = Number(value);
          if (isNaN(num) || num <= 0) {
            Alert.alert("Lỗi", "Nhập số hợp lệ!");
          } else {
            onAction(num);
            setValue("");
          }
        }}
        disabled={disabled}
      >
        <Text style={styles.actionButtonText}>
          {disabled ? "⏳" : actionText}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default HeoDat;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fffafc" 
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
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#d63384",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#ff9ec6",
    fontWeight: '500',
  },
  box: {
    backgroundColor: "#fff",
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#fff0f5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#d63384",
    marginBottom: 16,
    textAlign: "center",
  },
  bankBalanceContainer: {
    backgroundColor: '#f0f8ff',
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e6f3ff',
  },
  bankBalanceLabel: {
    fontSize: 16,
    color: "#666",
    marginBottom: 8,
    fontWeight: '600',
  },
  bankBalanceAmount: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0077b6",
  },
  bankActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bankActionColumn: {
    flex: 1,
    marginHorizontal: 5,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#d63384",
    flex: 1,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#ffe6ee',
  },
  deleteText: {
    fontSize: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d63384',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 2,
    borderColor: '#ffe6ee',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    backgroundColor: 'white',
    color: '#d63384',
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },
  addButton: {
    backgroundColor: '#ff6b9d',
    padding: 16,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  addButtonText: { 
    color: "white", 
    fontWeight: "bold", 
    fontSize: 16 
  },
  actionButton: {
    backgroundColor: '#4facfe',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: '#4facfe',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 60,
  },
  withdrawButton: {
    backgroundColor: '#FFA726',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  info: {
    fontSize: 14,
    marginBottom: 12,
    color: '#666',
  },
  amount: {
    color: "#0077b6",
    fontWeight: "bold",
  },
  progressBar: {
    backgroundColor: "#ffe6ee",
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  progress: {
    backgroundColor: "#ff6b9d",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  progressText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
});
=======
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  Timestamp,
  updateDoc
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebase";

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  createdAt?: any;
}

interface BankAccount {
  id: string;
  balance: number;
}

const HeoDat: React.FC = () => {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [goalName, setGoalName] = useState("");
  const [goalAmount, setGoalAmount] = useState("");

  // 🔹 Lấy danh sách heo đất và tài khoản ngân hàng từ Firebase
  const loadData = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Lỗi", "Vui lòng đăng nhập!");
      return;
    }

    try {
      // Lấy danh sách heo đất
      const goalsRef = collection(db, "users", user.uid, "goals");
      const goalsSnapshot = await getDocs(goalsRef);
      const goalsData = goalsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        name: doc.data().name,
        targetAmount: doc.data().targetAmount || doc.data().amount || 0,
        currentAmount: doc.data().currentAmount || doc.data().current || 0,
        createdAt: doc.data().createdAt,
      })) as Goal[];
      setGoals(goalsData);

      // Lấy tài khoản ngân hàng
      const bankRef = collection(db, "users", user.uid, "bankAccount");
      const bankSnapshot = await getDocs(bankRef);
      
      if (bankSnapshot.empty) {
        // Tạo tài khoản ngân hàng mới nếu chưa có
        const newBankAccount = {
          balance: 0,
          createdAt: Timestamp.now(),
        };
        const bankDocRef = await addDoc(collection(db, "users", user.uid, "bankAccount"), newBankAccount);
        setBankAccount({ id: bankDocRef.id, balance: 0 });
      } else {
        const bankData = bankSnapshot.docs[0];
        setBankAccount({ 
          id: bankData.id, 
          balance: bankData.data().balance || 0 
        });
      }
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu:", error);
      Alert.alert("Lỗi", "Không thể tải dữ liệu!");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 🔹 Cập nhật số dư tài khoản ngân hàng
  const updateBankBalance = async (newBalance: number) => {
    const user = auth.currentUser;
    if (!user || !bankAccount) return;

    try {
      const bankRef = doc(db, "users", user.uid, "bankAccount", bankAccount.id);
      await updateDoc(bankRef, { balance: newBalance });
      setBankAccount({ ...bankAccount, balance: newBalance });
    } catch (error) {
      console.error("Lỗi khi cập nhật số dư:", error);
      Alert.alert("Lỗi", "Không thể cập nhật số dư!");
    }
  };

  // 🔹 Cập nhật heo đất
  const updateGoal = async (goalId: string, updates: any) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const goalRef = doc(db, "users", user.uid, "goals", goalId);
      await updateDoc(goalRef, updates);
    } catch (error) {
      console.error("Lỗi khi cập nhật heo đất:", error);
      Alert.alert("Lỗi", "Không thể cập nhật heo đất!");
    }
  };

  // 🔹 Thêm heo đất mới
  const createGoal = async () => {
    if (!goalName || !goalAmount) {
      return Alert.alert("Lỗi", "Vui lòng nhập tên và số tiền mục tiêu!");
    }

    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Lỗi", "Vui lòng đăng nhập!");
      return;
    }

    try {
      const goalsRef = collection(db, "users", user.uid, "goals");
      await addDoc(goalsRef, {
        name: goalName,
        targetAmount: Number(goalAmount),
        currentAmount: 0,
        createdAt: Timestamp.now(),
      });

      Alert.alert("Thành công", "Đã thêm heo đất mới!");
      setGoalName("");
      setGoalAmount("");
      loadData();
    } catch (error) {
      console.error("Lỗi khi thêm heo đất:", error);
      Alert.alert("Lỗi", "Không thể thêm heo đất!");
    }
  };

  // 🔹 Nạp tiền vào tài khoản ngân hàng
  const depositToBank = async (amount: number) => {
    if (amount <= 0) return Alert.alert("Lỗi", "Số tiền không hợp lệ!");
    
    if (!bankAccount) {
      Alert.alert("Lỗi", "Tài khoản ngân hàng chưa sẵn sàng!");
      return;
    }

    const newBalance = bankAccount.balance + amount;
    await updateBankBalance(newBalance);
    Alert.alert("Thành công", `Đã nạp ${amount.toLocaleString()}đ vào tài khoản!`);
  };

  // 🔹 Rút tiền từ tài khoản ngân hàng
  const withdrawFromBank = async (amount: number) => {
    if (amount <= 0) return Alert.alert("Lỗi", "Số tiền không hợp lệ!");
    
    if (!bankAccount) {
      Alert.alert("Lỗi", "Tài khoản ngân hàng chưa sẵn sàng!");
      return;
    }

    if (bankAccount.balance < amount) {
      return Alert.alert("Lỗi", "Không đủ tiền trong tài khoản ngân hàng!");
    }

    const newBalance = bankAccount.balance - amount;
    await updateBankBalance(newBalance);
    Alert.alert("Thành công", `Đã rút ${amount.toLocaleString()}đ từ tài khoản!`);
  };

  // 🔹 Nạp tiền vào heo đất (từ tài khoản ngân hàng)
  const depositToPiggy = async (goalIndex: number, amount: number) => {
    if (amount <= 0) return Alert.alert("Lỗi", "Số tiền không hợp lệ!");
    
    if (!bankAccount) {
      Alert.alert("Lỗi", "Tài khoản ngân hàng chưa sẵn sàng!");
      return;
    }

    if (bankAccount.balance < amount) {
      return Alert.alert("Lỗi", "Không đủ tiền trong tài khoản ngân hàng!");
    }

    const goal = goals[goalIndex];
    const newGoalAmount = goal.currentAmount + amount;
    const newBankBalance = bankAccount.balance - amount;

    try {
      // Cập nhật cả heo đất và tài khoản ngân hàng
      await Promise.all([
        updateGoal(goal.id, { currentAmount: newGoalAmount }),
        updateBankBalance(newBankBalance)
      ]);

      // Cập nhật UI
      const updatedGoals = [...goals];
      updatedGoals[goalIndex].currentAmount = newGoalAmount;
      setGoals(updatedGoals);

      Alert.alert("Thành công", `Đã nạp ${amount.toLocaleString()}đ vào heo đất "${goal.name}"!`);
    } catch (error) {
      Alert.alert("Lỗi", "Không thể nạp tiền vào heo đất!");
    }
  };

  // 🔹 Rút tiền ra khỏi heo đất (về tài khoản ngân hàng)
  const withdrawFromPiggy = async (goalIndex: number, amount: number) => {
    if (amount <= 0) return Alert.alert("Lỗi", "Số tiền không hợp lệ!");
    
    if (!bankAccount) {
      Alert.alert("Lỗi", "Tài khoản ngân hàng chưa sẵn sàng!");
      return;
    }

    const goal = goals[goalIndex];
    if (goal.currentAmount < amount) {
      return Alert.alert("Lỗi", "Không đủ tiền trong heo đất!");
    }

    const newGoalAmount = goal.currentAmount - amount;
    const newBankBalance = bankAccount.balance + amount;

    try {
      // Cập nhật cả heo đất và tài khoản ngân hàng
      await Promise.all([
        updateGoal(goal.id, { currentAmount: newGoalAmount }),
        updateBankBalance(newBankBalance)
      ]);

      // Cập nhật UI
      const updatedGoals = [...goals];
      updatedGoals[goalIndex].currentAmount = newGoalAmount;
      setGoals(updatedGoals);

      Alert.alert("Thành công", `Đã rút ${amount.toLocaleString()}đ từ heo đất "${goal.name}"!`);
    } catch (error) {
      Alert.alert("Lỗi", "Không thể rút tiền từ heo đất!");
    }
  };

  // 🔹 Xóa heo đất (chuyển tiền về tài khoản ngân hàng)
  const deleteGoal = async (goalIndex: number) => {
    const goal = goals[goalIndex];
    
    Alert.alert(
      "Xác nhận", 
      goal.currentAmount > 0 
        ? `Bạn có chắc muốn xóa heo đất "${goal.name}"?\n\nSố tiền ${goal.currentAmount.toLocaleString()}đ sẽ được chuyển về tài khoản ngân hàng.`
        : `Bạn có chắc muốn xóa heo đất "${goal.name}"?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            const user = auth.currentUser;
            if (!user || !bankAccount) return;

            try {
              // Chuyển tiền từ heo đất về tài khoản ngân hàng
              if (goal.currentAmount > 0) {
                const newBankBalance = bankAccount.balance + goal.currentAmount;
                await updateBankBalance(newBankBalance);
              }

              // Xóa heo đất
              const goalRef = doc(db, "users", user.uid, "goals", goal.id);
              await deleteDoc(goalRef);
              
              // Cập nhật UI
              const updatedGoals = goals.filter((_, i) => i !== goalIndex);
              setGoals(updatedGoals);
              
              Alert.alert(
                "Thành công", 
                goal.currentAmount > 0
                  ? `Đã xóa heo đất!\nSố tiền ${goal.currentAmount.toLocaleString()}đ đã được chuyển về tài khoản ngân hàng.`
                  : "Đã xóa heo đất!"
              );
            } catch (error) {
              console.error("Lỗi khi xóa heo đất:", error);
              Alert.alert("Lỗi", "Không thể xóa heo đất!");
            }
          },
        },
      ]
    );
  };

  // 🔹 Tính phần trăm tiết kiệm
  const getProgress = (goal: Goal) => {
    return goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🐷 Heo Dat Savings</Text>
        <Text style={styles.subtitle}>Manage your savings goals</Text>
      </View>

      {/* Tài khoản ngân hàng - MỘT TÀI KHOẢN DUY NHẤT */}
      <View style={styles.box}>
        <Text style={styles.sectionTitle}>💰 TÀI KHOẢN NGÂN HÀNG</Text>
        
        <View style={styles.bankBalanceContainer}>
          <Text style={styles.bankBalanceLabel}>Số dư khả dụng</Text>
          <Text style={styles.bankBalanceAmount}>
            {bankAccount ? bankAccount.balance.toLocaleString("vi-VN") : "0"} VND
          </Text>
        </View>

        <View style={styles.bankActions}>
          <View style={styles.bankActionColumn}>
            <Text style={styles.label}>💵 Nạp tiền vào tài khoản</Text>
            <ActionInput
              placeholder=""
              actionText="Nạp"
              onAction={(v) => depositToBank(v)}
            />
          </View>
          
          <View style={styles.bankActionColumn}>
            <Text style={styles.label}>💸 Rút tiền từ tài khoản</Text>
            <ActionInput
              placeholder=""
              actionText="Rút"
              onAction={(v) => withdrawFromBank(v)}
            />
          </View>
        </View>
      </View>

      {/* Form tạo mục tiêu */}
      <View style={styles.box}>
        <Text style={styles.sectionTitle}>📝 TẠO MỤC TIÊU MỚI</Text>
        <Text style={styles.label}>Tên mục tiêu</Text>
        <TextInput
          style={styles.input}
          placeholder="VD: Du lịch Đà Lạt..."
          placeholderTextColor="#ff9ec6"
          value={goalName}
          onChangeText={setGoalName}
        />
        <Text style={styles.label}>Số tiền cần tiết kiệm (VND)</Text>
        <TextInput
          style={styles.input}
          placeholder="VD: 5000000"
          placeholderTextColor="#ff9ec6"
          keyboardType="numeric"
          value={goalAmount}
          onChangeText={setGoalAmount}
        />
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={createGoal}
          disabled={!bankAccount}
        >
          <Text style={styles.addButtonText}>
            {bankAccount ? "➕ Thêm mục tiêu" : "⏳ Đang tải..."}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Danh sách heo đất */}
      {goals.map((goal, index) => (
        <View style={styles.box} key={goal.id}>
          <View style={styles.goalHeader}>
            <Text style={styles.goalTitle}>🎯 {goal.name}</Text>
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={() => deleteGoal(index)}
            >
              <Text style={styles.deleteText}>🗑️</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.info}>
            Đã tiết kiệm:{" "}
            <Text style={styles.amount}>{goal.currentAmount.toLocaleString("vi-VN")}</Text>{" "}
            /{" "}
            <Text style={styles.amount}>{goal.targetAmount.toLocaleString("vi-VN")}</Text> VND
          </Text>

          {/* Thanh tiến độ */}
          <View style={styles.progressBar}>
            <View style={[styles.progress, { width: `${getProgress(goal)}%` }]}>
              <Text style={styles.progressText}>
                {Math.floor(getProgress(goal))}%
              </Text>
            </View>
          </View>

          {/* Số dư tài khoản hiện tại (chỉ để tham khảo) */}
          <Text style={[styles.label, { marginTop: 15 }]}>
            💰 Số dư tài khoản hiện tại:{" "}
            <Text style={styles.amount}>
              {bankAccount ? bankAccount.balance.toLocaleString("vi-VN") : "0"} VND
            </Text>
          </Text>

          {/* Nạp tiền vào heo đất */}
          <Text style={styles.label}>🐷 Chuyển tiền vào heo đất</Text>
          <ActionInput
            placeholder="VD: 500000"
            actionText="Nạp"
            onAction={(v) => depositToPiggy(index, v)}
            disabled={!bankAccount}
          />

          {/* Rút tiền ra khỏi heo đất */}
          <Text style={styles.label}>💸 Rút tiền ra khỏi heo đất</Text>
          <ActionInput
            placeholder="VD: 200000"
            actionText="Rút"
            onAction={(v) => withdrawFromPiggy(index, v)}
            disabled={!bankAccount}
          />
        </View>
      ))}
    </ScrollView>
  );
};

// 🔹 Component con để nhập + nhấn nút nhanh
const ActionInput = ({
  placeholder,
  actionText,
  onAction,
  disabled = false,
}: {
  placeholder: string;
  actionText: string;
  onAction: (value: number) => void;
  disabled?: boolean;
}) => {
  const [value, setValue] = useState("");
  return (
    <View style={styles.row}>
      <TextInput
        style={[
          styles.input, 
          { flex: 1, marginRight: 10 },
          disabled && styles.disabledInput
        ]}
        placeholder={placeholder}
        placeholderTextColor="#ff9ec6"
        keyboardType="numeric"
        value={value}
        onChangeText={setValue}
        editable={!disabled}
      />
      <TouchableOpacity
        style={[
          styles.actionButton,
          actionText === "Rút" && styles.withdrawButton,
          disabled && styles.disabledButton
        ]}
        onPress={() => {
          if (disabled) return;
          const num = Number(value);
          if (isNaN(num) || num <= 0) {
            Alert.alert("Lỗi", "Nhập số hợp lệ!");
          } else {
            onAction(num);
            setValue("");
          }
        }}
        disabled={disabled}
      >
        <Text style={styles.actionButtonText}>
          {disabled ? "⏳" : actionText}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default HeoDat;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fffafc" 
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
    marginBottom: 8,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 1,
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
  backButtonText: {
    fontSize: 14,
    color: '#d63384',
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: "#d63384",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#ff9ec6",
    fontWeight: '500',
  },
  box: {
    backgroundColor: "#fff",
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#fff0f5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#d63384",
    marginBottom: 16,
    textAlign: "center",
  },
  bankBalanceContainer: {
    backgroundColor: '#f0f8ff',
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e6f3ff',
  },
  bankBalanceLabel: {
    fontSize: 16,
    color: "#666",
    marginBottom: 8,
    fontWeight: '600',
  },
  bankBalanceAmount: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0077b6",
  },
  bankActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bankActionColumn: {
    flex: 1,
    marginHorizontal: 5,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#d63384",
    flex: 1,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#ffe6ee',
  },
  deleteText: {
    fontSize: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d63384',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 2,
    borderColor: '#ffe6ee',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    backgroundColor: 'white',
    color: '#d63384',
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },
  addButton: {
    backgroundColor: '#ff6b9d',
    padding: 16,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  addButtonText: { 
    color: "white", 
    fontWeight: "bold", 
    fontSize: 16 
  },
  actionButton: {
    backgroundColor: '#4facfe',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: '#4facfe',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 60,
  },
  withdrawButton: {
    backgroundColor: '#FFA726',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  info: {
    fontSize: 14,
    marginBottom: 12,
    color: '#666',
  },
  amount: {
    color: "#0077b6",
    fontWeight: "bold",
  },
  progressBar: {
    backgroundColor: "#ffe6ee",
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  progress: {
    backgroundColor: "#ff6b9d",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  progressText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
});
>>>>>>> d8bd37f (Sua cac trang blank, them nut back len moi trang, verify email khi dang ky, them chuc nang lien ket va theo doi bien dong ngan hang (chua test),...)
