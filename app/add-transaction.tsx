import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebase";

export default function AddTransaction() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = params.id ? String(params.id) : null;
  
  console.log("🧩 ID nhận được:", id);

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<"Chi tiêu" | "Thu nhập">("Chi tiêu");
  const [note, setNote] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());

  // 🔹 Lấy dữ liệu khi có id
  useEffect(() => {
    const fetchTransaction = async () => {
      if (!id) {
        console.log("❌ Không có ID, không tải dữ liệu");
        return;
      }
      
      setLoading(true);
      try {
        console.log("📥 Đang tải dữ liệu với ID:", id);
        
        const user = auth.currentUser;
        if (!user) {
          Alert.alert("Lỗi", "Người dùng chưa đăng nhập");
          return;
        }

        const docRef = doc(db, "users", user.uid, "transactions", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log("✅ Dữ liệu nhận được:", data);
          setAmount(data.amount?.toString() || "");
          setCategory(data.category || "");
          setType(data.type || "Chi tiêu");
          setNote(data.note || "");
          
          // Cập nhật ngày từ Firestore
          if (data.createdAt) {
            const firestoreDate = data.createdAt.toDate();
            setSelectedDate(firestoreDate);
          }
        } else {
          console.log("❌ Không tìm thấy document với ID này");
          Alert.alert("Lỗi", "Không tìm thấy giao dịch này");
        }
      } catch (error: any) {
        console.error("❌ Lỗi tải dữ liệu:", error);
        Alert.alert("Lỗi", `Không thể tải dữ liệu: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchTransaction();
  }, [id]);

  // 🔹 Xoá giao dịch
  const handleDelete = async () => {
    console.log("=== 🗑️ BẮT ĐẦU QUÁ TRÌNH XÓA ===");
    console.log("🆔 ID để xóa:", id);
    
    if (!id || id === "null" || id === "undefined") {
      Alert.alert("❌ Lỗi", "Không tìm thấy ID giao dịch để xóa");
      return;
    }

    Alert.alert(
      "Xoá giao dịch", 
      `Bạn có chắc muốn xoá giao dịch ${type} này không?`,
      [
        { text: "Huỷ", style: "cancel" },
        {
          text: "Xoá",
          style: "destructive",
          onPress: async () => {
            console.log("✅ Người dùng xác nhận xóa");
            setDeleting(true);
            
            try {
              const user = auth.currentUser;
              if (!user) {
                Alert.alert("Lỗi", "Người dùng chưa đăng nhập");
                return;
              }

              const docRef = doc(db, "users", user.uid, "transactions", id);
              
              // Kiểm tra document có tồn tại không
              const docSnap = await getDoc(docRef);
              
              if (!docSnap.exists()) {
                Alert.alert("❌ Lỗi", "Giao dịch không tồn tại");
                return;
              }
              
              await deleteDoc(docRef);
              
              console.log("✅ Xóa thành công!");
              
              Alert.alert("🗑️ Đã xoá", "Giao dịch đã được xoá thành công!");
              router.back();
              
            } catch (error: any) {
              console.error("❌ Lỗi xoá giao dịch:", error);
              
              let errorMessage = "Không thể xoá giao dịch.";
              if (error.code === 'permission-denied') {
                errorMessage = "Không có quyền xóa giao dịch. Kiểm tra Firestore Rules.";
              } else if (error.code === 'not-found') {
                errorMessage = "Giao dịch không tồn tại.";
              }
              
              Alert.alert("❌ Lỗi", `${errorMessage}\n\nMã lỗi: ${error.code}`);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  // 🔹 Xử lý chọn ngày
  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  // 🔹 Hiển thị date picker
  const showDatePickerModal = () => {
    setShowDatePicker(true);
  };

  // 🔹 Định dạng ngày tháng
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // 🔹 Thêm hoặc cập nhật
  const handleSave = async () => {
    if (!amount || !category) {
      Alert.alert("Lỗi", "Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Lỗi", "Người dùng chưa đăng nhập");
      return;
    }

    setLoading(true);
    try {
      const transactionData = {
        amount: parseFloat(amount),
        category,
        type,
        note,
        updatedAt: Timestamp.now(),
      };

      if (id) {
        // Cập nhật giao dịch cũ
        const docRef = doc(db, "users", user.uid, "transactions", id);
        await updateDoc(docRef, transactionData);
        Alert.alert("✅ Thành công", "Đã cập nhật giao dịch!");
      } else {
        // Thêm giao dịch mới - sử dụng ngày đã chọn
        const ref = collection(db, "users", user.uid, "transactions");
        await addDoc(ref, {
          ...transactionData,
          createdAt: Timestamp.fromDate(selectedDate),
        });
        Alert.alert("✅ Thành công", "Đã thêm giao dịch!");
      }
      router.back();
    } catch (error: any) {
      console.error("Lỗi lưu giao dịch:", error);
      Alert.alert("❌ Lỗi", error.message || "Không thể lưu giao dịch.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {id ? " Chỉnh sửa giao dịch" : " Thêm giao dịch mới"}
        </Text>
        {id && (
          <Text style={styles.subtitle}>ID: {id}</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff6b9d" />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            {/* --- Số tiền --- */}
            <Text style={styles.label}>💰 Số tiền:</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập số tiền"
              placeholderTextColor="#ff9ec6"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            {/* --- Danh mục --- */}
            <Text style={styles.label}>🏷️ Danh mục:</Text>
            <TextInput
              style={styles.input}
              placeholder="Ví dụ: Ăn uống, Đi lại..."
              placeholderTextColor="#ff9ec6"
              value={category}
              onChangeText={setCategory}
            />

            {/* --- Loại giao dịch --- */}
            <Text style={styles.label}>📂 Loại giao dịch:</Text>
            <View style={styles.typeContainer}>
              {["Chi tiêu", "Thu nhập"].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeButton,
                    type === t && (t === "Chi tiêu" ? styles.activeExpense : styles.activeIncome),
                  ]}
                  onPress={() => setType(t as "Chi tiêu" | "Thu nhập")}
                >
                  <Text style={[
                    styles.typeIcon,
                    type === t && styles.activeTypeIcon
                  ]}>
                    {t === "Chi tiêu" ? "💸" : "💰"}
                  </Text>
                  <Text style={[
                    styles.typeText,
                    type === t && styles.activeTypeText
                  ]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* --- Ghi chú --- */}
            <Text style={styles.label}>📝 Ghi chú:</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Thêm ghi chú (nếu có)"
              placeholderTextColor="#ff9ec6"
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* --- Ngày giao dịch --- */}
            <Text style={styles.label}>📅 Ngày:</Text>
            <TouchableOpacity 
              style={styles.dateButton}
              onPress={showDatePickerModal}
            >
              <Text style={styles.dateIcon}>📅</Text>
              <Text style={styles.dateText}>
                {selectedDate.toLocaleDateString("vi-VN")}
              </Text>
              <Text style={styles.dateChangeText}>Thay đổi</Text>
            </TouchableOpacity>

            {/* Date Picker */}
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()} // Không cho chọn ngày trong tương lai
              />
            )}

            {/* --- Nút lưu --- */}
            <TouchableOpacity 
              style={[
                styles.saveButton, 
                loading && styles.buttonDisabled
              ]} 
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  
                  <Text style={styles.saveText}>
                    {id ? "Cập nhật giao dịch" : "Lưu giao dịch"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* --- Nút xoá (chỉ hiện khi đang chỉnh sửa) --- */}
            {id && (
              <TouchableOpacity
                style={[
                  styles.deleteButton, 
                  deleting && styles.buttonDisabled
                ]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Text style={styles.deleteIcon}>🗑️</Text>
                    <Text style={styles.deleteText}>Xoá giao dịch</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Thêm khoảng trống ở cuối để dễ scroll */}
            <View style={styles.bottomSpacer} />
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fffafc" 
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
    fontSize: 12,
    textAlign: "center",
    color: "#ff9ec6",
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#ff6b9d',
    fontSize: 16,
  },
  formContainer: {
    flex: 1,
    padding: 20,
    paddingBottom: 40, // Thêm padding bottom để không bị che nút
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d63384',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 2,
    borderColor: '#ffe6ee',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
    color: '#d63384',
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  textArea: {
    height: 120, // Giảm chiều cao xuống một chút
    fontSize: 16,
    textAlignVertical: 'top',
    paddingTop: 16,
    lineHeight: 22,
  },
  // Date Picker Styles
  dateButton: {
    borderWidth: 2,
    borderColor: '#ffe6ee',
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dateIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#d63384',
    fontWeight: '600',
    flex: 1,
  },
  dateChangeText: {
    fontSize: 14,
    color: '#ff6b9d',
    fontWeight: '500',
  },
  typeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  typeButton: {
    flex: 1,
    alignItems: "center",
    padding: 16,
    marginHorizontal: 6,
    borderWidth: 2,
    borderRadius: 16,
    borderColor: "#ffe6ee",
    backgroundColor: 'white',
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activeExpense: { 
    backgroundColor: '#ffe6ee', 
    borderColor: '#ff6b9d',
    shadowColor: '#ff6b9d',
    shadowOpacity: 0.3,
  },
  activeIncome: { 
    backgroundColor: '#fce4ec', 
    borderColor: '#ff9ec6',
    shadowColor: '#ff9ec6',
    shadowOpacity: 0.3,
  },
  typeIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  activeTypeIcon: {
    fontSize: 26,
  },
  typeText: { 
    color: '#ff9ec6', 
    fontWeight: "600",
    fontSize: 14,
  },
  activeTypeText: { 
    color: '#d63384', 
    fontWeight: "bold",
  },
  saveButton: {
    backgroundColor: '#ff6b9d',
    padding: 18,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: 'row',
    marginTop: 30,
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  deleteButton: {
    backgroundColor: '#ff9ec6',
    padding: 18,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: 'row',
    marginTop: 12,
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  saveText: { 
    color: "white", 
    fontWeight: "bold", 
    fontSize: 18 
  },
  deleteIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  deleteText: { 
    color: "white", 
    fontWeight: "bold", 
    fontSize: 16 
  },
  bottomSpacer: {
    height: 30, // Thêm khoảng trống ở cuối
  },
});
