<<<<<<< HEAD
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  SectionList,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebase";
import { logout } from "../utils/auth"; // Import hàm đăng xuất

// 🔹 Hàm xuất file Excel - tích hợp trực tiếp
const exportToExcel = async (transactions: any[]) => {
  try {
    if (transactions.length === 0) {
      Alert.alert("ℹ️ Thông báo", "Không có dữ liệu để xuất file");
      return;
    }

    // Tạo nội dung CSV
    let csvContent = "Ghi chú,Số tiền,Loại,Danh mục,Ngày tạo\n";
    
    transactions.forEach(transaction => {
      const row = [
        `"${transaction.note || 'Không có'}"`,
        transaction.amount || 0,
        `"${transaction.type}"`,
        `"${transaction.category || 'Khác'}"`,
        `"${transaction.createdAt?.toDate?.()?.toLocaleDateString('vi-VN') || 'Không rõ'}"`
      ].join(',');
      csvContent += row + '\n';
    });

    // Tạo tên file với ngày tháng
    const date = new Date();
    const fileName = `MoneyMeow_Export_${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}.csv`;

    if (Platform.OS === 'web') {
      // 🔹 Cho web: Tải file trực tiếp
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      Alert.alert("✅ Thành công", "File Excel đã được tải xuống!");
    } else {
      // 🔹 Cho mobile: Chia sẻ file
      await Share.share({
        title: 'Xuất file Excel - MoneyMeow',
        message: csvContent,
      });
    }

  } catch (error) {
    console.error('Lỗi xuất file:', error);
    Alert.alert("❌ Lỗi", "Không thể xuất file Excel");
  }
};

// 🔹 Hàm nhóm giao dịch theo tháng
const groupTransactionsByMonth = (transactions: any[]) => {
  const grouped: { [key: string]: any[] } = {};
  
  transactions.forEach(transaction => {
    let transactionDate: Date;
    
    if (transaction.createdAt && transaction.createdAt.toDate) {
      transactionDate = transaction.createdAt.toDate();
    } else if (transaction.createdAt && typeof transaction.createdAt === 'string') {
      transactionDate = new Date(transaction.createdAt);
    } else {
      transactionDate = new Date();
    }
    
    const monthYear = transactionDate.toLocaleDateString('vi-VN', {
      month: 'long',
      year: 'numeric'
    });
    
    if (!grouped[monthYear]) {
      grouped[monthYear] = [];
    }
    
    grouped[monthYear].push(transaction);
  });
  
  return grouped;
};

// 🔹 Hàm chuyển đổi dữ liệu nhóm thành mảng cho FlatList
const prepareSectionData = (groupedTransactions: { [key: string]: any[] }) => {
  const sections: { title: string; data: any[] }[] = [];
  
  Object.keys(groupedTransactions)
    .sort((a, b) => {
      // Sắp xếp từ tháng mới nhất đến cũ nhất
      const dateA = new Date('1 ' + a);
      const dateB = new Date('1 ' + b);
      return dateB.getTime() - dateA.getTime();
    })
    .forEach(monthYear => {
      sections.push({
        title: monthYear,
        data: groupedTransactions[monthYear]
      });
    });
  
  return sections;
};

export default function HomeScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [sectionData, setSectionData] = useState<{ title: string; data: any[] }[]>([]);
  const [user, setUser] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  // 🔹 Theo dõi trạng thái đăng nhập
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return unsubscribe;
  }, []);

  // 🔹 Lấy dữ liệu Firestore theo user
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setSectionData([]);
      return;
    }

    const transactionsRef = collection(db, "users", user.uid, "transactions");
    const q = query(transactionsRef, orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log(`📊 Loaded ${list.length} transactions for user: ${user.uid}`);
      setTransactions(list);
      
      // Nhóm giao dịch theo tháng
      const grouped = groupTransactionsByMonth(list);
      const sections = prepareSectionData(grouped);
      setSectionData(sections);
    }, (error) => {
      console.error("❌ Lỗi khi lấy giao dịch:", error);
      Alert.alert("Lỗi", "Không thể tải danh sách giao dịch");
    });

    return unsubscribe;
  }, [user]);

  // 🔹 Tính tổng thu nhập và chi tiêu
  const totalIncome = transactions
    .filter((t) => t.type === "Thu nhập")
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalExpense = transactions
    .filter((t) => t.type === "Chi tiêu")
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const balance = totalIncome - totalExpense;

  // 🔹 Xử lý đăng xuất
  const handleLogout = async () => {
    Alert.alert(
      "Đăng xuất",
      "Bạn có chắc muốn đăng xuất khỏi ứng dụng?",
      [
        {
          text: "Huỷ",
          style: "cancel"
        },
        {
          text: "Đăng xuất",
          style: "destructive",
          onPress: async () => {
            try {
              console.log("🔄 Đang đăng xuất...");
              await logout();
              
              // Thêm chuyển hướng thủ công để đảm bảo
              setTimeout(() => {
                router.replace("/login");
              }, 500);
              
            } catch (error: any) {
              console.error("❌ Lỗi đăng xuất:", error.message);
              Alert.alert("❌ Lỗi", `Không thể đăng xuất: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  // 🔹 Xử lý mở/đóng menu
  const toggleMenu = () => {
    if (menuVisible) {
      // Đóng menu
      Animated.timing(animation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setMenuVisible(false));
    } else {
      // Mở menu
      setMenuVisible(true);
      Animated.timing(animation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  // 🔹 Animation cho các nút menu
  const menuButtonAnimation = {
    transform: [
      {
        scale: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        }),
      },
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
    opacity: animation,
  };

  // 🔹 Render header cho mỗi section (tháng)
  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderContent}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.sectionLine} />
      </View>
    </View>
  );

  // 🔹 Render mỗi item giao dịch
  const renderTransactionItem = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity
      style={[
        styles.transactionItem,
        index === 0 && { marginTop: 8 }
      ]}
      onPress={() =>
        router.push({
          pathname: "/add-transaction",
          params: { id: item.id },
        })
      }
    >
      <View style={styles.transactionLeft}>
        <View style={[
          styles.typeIndicator,
          { 
            backgroundColor: item.type === "Chi tiêu" ? '#ffe6ee' : '#fce4ec',
            borderColor: item.type === "Chi tiêu" ? '#ff6b9d' : '#ff9ec6'
          }
        ]}>
          <Text style={[
            styles.typeIcon,
            { color: item.type === "Chi tiêu" ? '#ff6b9d' : '#ff9ec6' }
          ]}>
            {item.type === "Chi tiêu" ? "💸" : "💰"}
          </Text>
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.category}>{item.category}</Text>
          {item.note ? (
            <Text style={styles.note} numberOfLines={1}>
              {item.note}
            </Text>
          ) : null}
          <Text style={styles.date}>
            {item.createdAt?.toDate?.()?.toLocaleDateString('vi-VN') || 'Hôm nay'}
          </Text>
        </View>
      </View>

      <View style={styles.transactionRight}>
        <Text
          style={[
            styles.amount,
            { color: item.type === "Chi tiêu" ? "#ff6b9d" : "#ff9ec6" },
          ]}
        >
          {item.type === "Chi tiêu" ? "-" : "+"}
          {item.amount?.toLocaleString()} đ
        </Text>
        <View style={[
          styles.typeBadge,
          { backgroundColor: item.type === "Chi tiêu" ? '#ff6b9d' : '#ff9ec6' }
        ]}>
          <Text style={styles.typeBadgeText}>
            {item.type === "Chi tiêu" ? "Chi" : "Thu"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // 🔹 Hiển thị màn hình khi chưa đăng nhập
  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.welcomeText}>MoneyMeow 💖</Text>
            <Text style={styles.balanceLabel}>Vui lòng đăng nhập</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🔐</Text>
          <Text style={styles.emptyText}>Chưa đăng nhập</Text>
          <Text style={styles.emptySubText}>Vui lòng đăng nhập để xem giao dịch</Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.loginButtonText}>Đăng nhập ngay</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* --- Header với thông tin tổng quan --- */}
      <View style={styles.header}>
        {/* Nút đăng xuất ở góc phải */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.welcomeText}>Xin chào! 👋</Text>
          <Text style={styles.balanceLabel}>Số dư hiện tại</Text>
          <Text style={[
            styles.balance,
            { color: balance >= 0 ? '#ff6b9d' : '#ff4757' }
          ]}>
            {balance.toLocaleString()} đ
          </Text>
          
          <View style={styles.incomeExpenseContainer}>
            <View style={styles.incomeExpenseItem}>
              <View style={[styles.iconCircle, { backgroundColor: '#ff9ec6' }]}>
                <Text style={styles.iconText}>↑</Text>
              </View>
              <View>
                <Text style={styles.incomeExpenseLabel}>Thu nhập</Text>
                <Text style={styles.incomeExpenseAmount}>{totalIncome.toLocaleString()} đ</Text>
              </View>
            </View>
            
            <View style={styles.incomeExpenseItem}>
              <View style={[styles.iconCircle, { backgroundColor: '#ff9ec6' }]}>
                <Text style={styles.iconText}>↓</Text>
              </View>
              <View>
                <Text style={styles.incomeExpenseLabel}>Chi tiêu</Text>
                <Text style={styles.incomeExpenseAmount}>{totalExpense.toLocaleString()} đ</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* --- Danh sách giao dịch --- */}
      <View style={styles.transactionSection}>
        <View style={styles.sectionHeaderMain}>
          <Text style={styles.sectionTitleMain}>Giao dịch gần đây</Text>
          <Text style={styles.transactionCount}>{transactions.length} giao dịch</Text>
        </View>

        <SectionList
          sections={sectionData}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderTransactionItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>💖</Text>
              <Text style={styles.emptyText}>Chưa có giao dịch nào!</Text>
              <Text style={styles.emptySubText}>Hãy thêm giao dịch đầu tiên của bạn</Text>
            </View>
          }
        />
      </View>

      {/* --- Floating Action Buttons --- */}
      <View style={styles.buttonContainer}>
        {/* Menu các nút chức năng */}
        {menuVisible && (
          <View style={styles.menuContainer}>
            
            {/* 📤 Nút Kết Bạn */}
            <Animated.View style={[styles.menuButtonWrapper, menuButtonAnimation]}>
              <TouchableOpacity
                style={[styles.menuButton, styles.friendsButton]}
                onPress={() => {
                  toggleMenu();
                  router.push("/AddFriends");
                }}
              >
                <Text style={styles.menuButtonIcon}>🤝</Text>
                <Text style={styles.menuButtonLabel}>Kết Bạn</Text>
              </TouchableOpacity>
            </Animated.View>

 {/* 💵 Nút Quỹ Chung */}
            <Animated.View style={[styles.menuButtonWrapper, menuButtonAnimation]}>
              <TouchableOpacity
                style={[styles.menuButton, styles.fundButton]}
                onPress={() => {
                  toggleMenu();
                  router.push("/Messages");
                }}
              >
                <Text style={styles.menuButtonIcon}>🗨️</Text>
                <Text style={styles.menuButtonLabel}>Tin Nhắn</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* 💵 Nút Quỹ Chung */}
            <Animated.View style={[styles.menuButtonWrapper, menuButtonAnimation]}>
              <TouchableOpacity
                style={[styles.menuButton, styles.fundButton]}
                onPress={() => {
                  toggleMenu();
                  router.push("/GroupFunds");
                }}
              >
                <Text style={styles.menuButtonIcon}>💵</Text>
                <Text style={styles.menuButtonLabel}>Quỹ Chung</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* 🐖 Nút Heo Đất */}
            <Animated.View style={[styles.menuButtonWrapper, menuButtonAnimation]}>
              <TouchableOpacity
                style={[styles.menuButton, styles.piggyButton]}
                onPress={() => {
                  toggleMenu();
                  router.push("/HeoDat");
                }}
              >
                <Text style={styles.menuButtonIcon}>🐖</Text>
                <Text style={styles.menuButtonLabel}>Heo Đất</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* 📈 Nút Thống kê */}
            <Animated.View style={[styles.menuButtonWrapper, menuButtonAnimation]}>
              <TouchableOpacity
                style={[styles.menuButton, styles.statsButton]}
                onPress={() => {
                  toggleMenu();
                  router.push("/statistics");
                }}
              >
                <Text style={styles.menuButtonIcon}>📈</Text>
                <Text style={styles.menuButtonLabel}>Thống kê</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* 📩 Nút Xuất Excel */}
            <Animated.View style={[styles.menuButtonWrapper, menuButtonAnimation]}>
              <TouchableOpacity
                style={[styles.menuButton, styles.excelButton]}
                onPress={() => {
                  toggleMenu();
                  exportToExcel(transactions);
                }}
              >
                <Text style={styles.menuButtonIcon}>📩</Text>
                <Text style={styles.menuButtonLabel}>Xuất Excel</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {/* Nút menu chính */}
        <TouchableOpacity
          style={[styles.mainMenuButton, menuVisible && styles.mainMenuButtonActive]}
          onPress={toggleMenu}
        >
          <Text style={styles.mainMenuIcon}>📋</Text>
        </TouchableOpacity>

        {/* ＋ Nút thêm giao dịch */}
        <TouchableOpacity
          style={[styles.floatingButton, styles.addButton]}
          onPress={() => router.push("/add-transaction")}
        >
          <Text style={styles.addIcon}>＋</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fffafc" 
  },

  // Header Styles
  header: {
    backgroundColor: '#fff0f5',
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
  headerContent: {
    padding: 24,
    paddingTop: 50,
  },
  // Nút đăng xuất
  logoutButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  logoutIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  logoutText: {
    fontSize: 12,
    color: '#ff6b9d',
    fontWeight: '600',
  },
  welcomeText: {
    fontSize: 16,
    color: '#ff6b9d',
    marginBottom: 8,
    fontWeight: '500',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#ff9ec6',
    marginBottom: 4,
    fontWeight: '500',
  },
  balance: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  incomeExpenseContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  incomeExpenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  iconText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  incomeExpenseLabel: {
    fontSize: 12,
    color: '#ff6b9d',
    marginBottom: 2,
    fontWeight: '500',
  },
  incomeExpenseAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d63384',
  },

  // Transaction Section
  transactionSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionHeaderMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitleMain: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d63384',
  },
  transactionCount: {
    fontSize: 12,
    color: '#ff9ec6',
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 120,
  },

  // Section Header (Phân cách tháng)
  sectionHeader: {
    marginTop: 20,
    marginBottom: 8,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff6b9d',
    marginRight: 12,
    backgroundColor: '#fff0f5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#ffd6e7',
    borderRadius: 1,
  },

  // Transaction Item
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    marginVertical: 6,
    padding: 16,
    borderRadius: 20,
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#fff0f5',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeIndicator: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginRight: 12,
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  typeIcon: {
    fontSize: 20,
  },
  transactionInfo: {
    flex: 1,
  },
  category: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d63384',
    marginBottom: 2,
  },
  note: {
    fontSize: 13,
    color: '#ff6b9d',
    marginBottom: 4,
  },
  date: {
    fontSize: 11,
    color: '#ff9ec6',
    fontWeight: '500',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  typeBadgeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#ff6b9d',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#ff9ec6',
    textAlign: 'center',
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#ff6b9d',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 16,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // Floating Buttons & Menu
  buttonContainer: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    alignItems: 'flex-end',
  },
  menuContainer: {
    position: 'absolute',
    bottom: 70,
    right: 0,
    alignItems: 'flex-end',
  },
  menuButtonWrapper: {
    marginBottom: 10,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  friendsButton: {
    backgroundColor: '#aedfff',
  },
  fundButton: {
    backgroundColor: '#ffd8a8',
  },
  piggyButton: {
    backgroundColor: '#ffb6c1',
  },
  statsButton: {
    backgroundColor: '#d8bfd8',
  },
  excelButton: {
    backgroundColor: '#98fb98',
  },
  menuButtonIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  menuButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  mainMenuButton: {
    backgroundColor: '#ff6b9d',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 12,
    marginBottom: 15,
  },
  mainMenuButtonActive: {
    backgroundColor: '#d63384',
    transform: [{ rotate: '45deg' }],
  },
  mainMenuIcon: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  floatingButton: {
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  addButton: {
    backgroundColor: '#ff6b9d',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 12,
  },
  addIcon: {
    color: 'white',
    fontSize: 24,
    fontWeight: '200',
  },
});
=======
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Platform,
  SectionList,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../firebase";

const exportToExcel = async (transactions: any[]) => {
  try {
    if (transactions.length === 0) {
      Alert.alert("Info", "No data to export");
      return;
    }
    let csvContent = "Note,Amount,Type,Category,Date\n";
    transactions.forEach(transaction => {
      const row = [
        `"${transaction.note || 'N/A'}"`,
        transaction.amount || 0,
        `"${transaction.type}"`,
        `"${transaction.category || 'Other'}"`,
        `"${transaction.createdAt?.toDate?.()?.toLocaleDateString('vi-VN') || 'Unknown'}"`
      ].join(',');
      csvContent += row + '\n';
    });
    const date = new Date();
    const fileName = `MoneyMeow_Export_${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}.csv`;
    if (Platform.OS === 'web') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      Alert.alert("Success", "Excel file downloaded!");
    } else {
      await Share.share({ title: 'Export Excel', message: csvContent });
    }
  } catch (error) {
    console.error('Export error:', error);
    Alert.alert("Error", "Could not export file");
  }
};

const groupTransactionsByMonth = (transactions: any[]) => {
  const grouped: { [key: string]: any[] } = {};
  transactions.forEach(transaction => {
    let transactionDate: Date;
    if (transaction.createdAt && transaction.createdAt.toDate) {
      transactionDate = transaction.createdAt.toDate();
    } else if (transaction.createdAt && typeof transaction.createdAt === 'string') {
      transactionDate = new Date(transaction.createdAt);
    } else {
      transactionDate = new Date();
    }
    const monthYear = transactionDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
    if (!grouped[monthYear]) grouped[monthYear] = [];
    grouped[monthYear].push(transaction);
  });
  return grouped;
};

const prepareSectionData = (groupedTransactions: { [key: string]: any[] }) => {
  const sections: { title: string; data: any[] }[] = [];
  Object.keys(groupedTransactions)
    .sort((a, b) => {
      const dateA = new Date('1 ' + a);
      const dateB = new Date('1 ' + b);
      return dateB.getTime() - dateA.getTime();
    })
    .forEach(monthYear => {
      sections.push({ title: monthYear, data: groupedTransactions[monthYear] });
    });
  return sections;
};

export default function HomeScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [sectionData, setSectionData] = useState<{ title: string; data: any[] }[]>([]);
  const [user, setUser] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [animation] = useState(new Animated.Value(0));
  const [bankConnected, setBankConnected] = useState(false);
  const [bankToastVisible, setBankToastVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      const bankStatus = localStorage?.getItem?.('bankConnected');
      if (bankStatus === 'true') {
        setBankConnected(true);
      } else {
        const hasSeenPrompt = localStorage?.getItem?.('bankPromptSeen');
        if (!hasSeenPrompt) {
          setTimeout(() => setBankToastVisible(true), 1500);
        }
      }
    }
  }, [user]);

  const connectBank = () => {
    setBankConnected(true);
    setBankToastVisible(false);
    try { localStorage?.setItem?.('bankConnected', 'true'); } catch {}
    try { localStorage?.setItem?.('bankPromptSeen', 'true'); } catch {}
    Alert.alert('Bank Connected', 'Your bank account has been linked. Transactions will be automatically detected.');
  };

  const dismissBankToast = () => {
    setBankToastVisible(false);
    try { localStorage?.setItem?.('bankPromptSeen', 'true'); } catch {}
  };

  const simulateBankTransactions = () => {
    if (!user || !bankConnected) return;
    const simulatedTransactions = [
      { note: 'Grocery Store', amount: 85000, type: 'Chi tiêu', category: 'Groceries', source: 'auto' },
      { note: 'Salary Deposit', amount: 15000000, type: 'Thu nhập', category: 'Salary', source: 'auto' },
      { note: 'Electric Bill', amount: 350000, type: 'Chi tiêu', category: 'Utilities', source: 'auto' },
      { note: 'Coffee Shop', amount: 45000, type: 'Chi tiêu', category: 'Food & Drink', source: 'auto' },
    ];
    const randomTx = simulatedTransactions[Math.floor(Math.random() * simulatedTransactions.length)];
    addDoc(collection(db, 'users', user.uid, 'transactions'), {
      ...randomTx,
      createdAt: Timestamp.now(),
    }).then(() => {
      Alert.alert('Auto-detected', `Found: ${randomTx.note} - ${randomTx.amount.toLocaleString()}d`);
    }).catch(() => {
      Alert.alert('Error', 'Could not sync bank transaction');
    });
  };

  useEffect(() => {
    if (!user) { setTransactions([]); setSectionData([]); return; }
    const transactionsRef = collection(db, "users", user.uid, "transactions");
    const q = query(transactionsRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setTransactions(list);
      const grouped = groupTransactionsByMonth(list);
      setSectionData(prepareSectionData(grouped));
    }, (error) => {
      console.error("Error loading transactions:", error);
    });
    return unsubscribe;
  }, [user]);

  const manualTransactions = transactions.filter((t) => (t.source || 'manual') === 'manual');
  const bankTransactions = transactions.filter((t) => t.source === 'auto');

  const totalIncome = transactions.filter((t) => t.type === "Thu nhập").reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpense = transactions.filter((t) => t.type === "Chi tiêu").reduce((sum, t) => sum + (t.amount || 0), 0);
  const balance = totalIncome - totalExpense;

  const toggleMenu = () => {
    if (menuVisible) {
      Animated.timing(animation, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setMenuVisible(false));
    } else {
      setMenuVisible(true);
      Animated.timing(animation, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  };

  const menuButtonAnimation = {
    transform: [
      { scale: animation.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
      { translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
    ],
    opacity: animation,
  };

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderContent}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.sectionLine} />
      </View>
    </View>
  );

  const renderTransactionItem = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity
      style={[styles.transactionItem, index === 0 && { marginTop: 8 }]}
      onPress={() => router.push({ pathname: "/add-transaction", params: { id: item.id } })}
    >
      <View style={styles.transactionLeft}>
        <View style={[styles.typeIndicator, {
          backgroundColor: item.type === "Chi tiêu" ? '#ffe6ee' : '#fce4ec',
          borderColor: item.type === "Chi tiêu" ? '#ff6b9d' : '#ff9ec6'
        }]}>
          <Text style={[styles.typeIcon, { color: item.type === "Chi tiêu" ? '#ff6b9d' : '#ff9ec6' }]}>
            {item.type === "Chi tiêu" ? "💸" : "💰"}
          </Text>
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.category}>{item.category}</Text>
          {item.note ? <Text style={styles.note} numberOfLines={1}>{item.note}</Text> : null}
          <Text style={styles.date}>
            {item.createdAt?.toDate?.()?.toLocaleDateString('vi-VN') || 'Today'}
          </Text>
        </View>
      </View>
      <View style={styles.transactionRight}>
        <Text style={[styles.amount, { color: item.type === "Chi tiêu" ? "#ff6b9d" : "#ff9ec6" }]}>
          {item.type === "Chi tiêu" ? "-" : "+"}{item.amount?.toLocaleString()} d
        </Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <View style={[styles.typeBadge, { backgroundColor: item.type === "Chi tiêu" ? '#ff6b9d' : '#ff9ec6' }]}>
            <Text style={styles.typeBadgeText}>{item.type === "Chi tiêu" ? "Chi" : "Thu"}</Text>
          </View>
          {item.source === 'auto' && (
            <View style={styles.autoBadge}><Text style={styles.autoBadgeText}>Bank</Text></View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderBankTransactionItem = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity
      style={[styles.bankTransactionItem, index === 0 && { marginTop: 4 }]}
      onPress={() => router.push({ pathname: "/add-transaction", params: { id: item.id } })}
    >
      <View style={styles.bankItemLeft}>
        <View style={styles.bankIcon}>
          <Text style={styles.bankIconText}>🏦</Text>
        </View>
        <View style={styles.bankItemInfo}>
          <Text style={styles.bankItemCategory}>{item.category}</Text>
          {item.note ? <Text style={styles.bankItemNote} numberOfLines={1}>{item.note}</Text> : null}
          <Text style={styles.bankItemDate}>
            {item.createdAt?.toDate?.()?.toLocaleDateString('vi-VN') || 'Today'}
          </Text>
        </View>
      </View>
      <View style={styles.bankItemRight}>
        <Text style={[styles.bankItemAmount, { color: item.type === "Chi tiêu" ? "#ff6b9d" : "#4facfe" }]}>
          {item.type === "Chi tiêu" ? "-" : "+"}{item.amount?.toLocaleString()} d
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.welcomeText}>MoneyMeow</Text>
            <Text style={styles.balanceLabel}>Please sign in</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🔐</Text>
          <Text style={styles.emptyText}>Not signed in</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.push("/login")}>
            <Text style={styles.loginButtonText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* CSKH button top-left */}
        <TouchableOpacity style={styles.cskhButton} onPress={() => router.push("/CSKH")}>
          <Text style={styles.cskhIcon}>🎧</Text>
          <Text style={styles.cskhText}>CSKH</Text>
        </TouchableOpacity>

        {/* Profile button top-right */}
        <TouchableOpacity style={styles.profileButton} onPress={() => router.push("/profile")}>
          <Text style={styles.profileIcon}>👤</Text>
          <Text style={styles.profileText}>Profile</Text>
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.welcomeText}>Xin chao!</Text>
          <Text style={styles.balanceLabel}>So du hien tai</Text>
          <Text style={[styles.balance, { color: balance >= 0 ? '#ff6b9d' : '#ff4757' }]}>
            {balance.toLocaleString()} d
          </Text>
          <View style={styles.incomeExpenseContainer}>
            <View style={styles.incomeExpenseItem}>
              <View style={[styles.iconCircle, { backgroundColor: '#ff9ec6' }]}>
                <Text style={styles.iconText}>↑</Text>
              </View>
              <View>
                <Text style={styles.incomeExpenseLabel}>Thu nhap</Text>
                <Text style={styles.incomeExpenseAmount}>{totalIncome.toLocaleString()} d</Text>
              </View>
            </View>
            <View style={styles.incomeExpenseItem}>
              <View style={[styles.iconCircle, { backgroundColor: '#ff9ec6' }]}>
                <Text style={styles.iconText}>↓</Text>
              </View>
              <View>
                <Text style={styles.incomeExpenseLabel}>Chi tieu</Text>
                <Text style={styles.incomeExpenseAmount}>{totalExpense.toLocaleString()} d</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Transaction lists */}
      <View style={styles.transactionSection}>
        <View style={styles.sectionHeaderMain}>
          <Text style={styles.sectionTitleMain}>Giao dich gan day</Text>
          <Text style={styles.transactionCount}>{transactions.length} giao dich</Text>
        </View>

        {/* Bank transactions standalone section */}
        {bankTransactions.length > 0 && (
          <View style={styles.bankSection}>
            <View style={styles.bankSectionHeader}>
              <Text style={styles.bankSectionTitle}>🏦 Tu ngan hang</Text>
              {bankConnected && (
                <TouchableOpacity style={styles.syncButtonSmall} onPress={simulateBankTransactions}>
                  <Text style={styles.syncButtonSmallText}>Sync</Text>
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={bankTransactions}
              keyExtractor={(item) => item.id}
              renderItem={renderBankTransactionItem}
              scrollEnabled={false}
              ListEmptyComponent={null}
            />
          </View>
        )}

        {/* Manual transactions section */}
        <View style={styles.manualSectionHeader}>
          <Text style={styles.manualSectionTitle}>✏️ Tao thu cong</Text>
          <Text style={styles.manualCount}>{manualTransactions.length}</Text>
        </View>
        <SectionList
          sections={prepareSectionData(groupTransactionsByMonth(manualTransactions))}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderTransactionItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>💖</Text>
              <Text style={styles.emptyText}>Chua co giao dich!</Text>
              <Text style={styles.emptySubText}>Hay them giao dich dau tien</Text>
            </View>
          }
        />
      </View>

      {/* Floating Action Buttons */}
      <View style={styles.buttonContainer}>
        {menuVisible && (
          <View style={styles.menuContainer}>
            <Animated.View style={[styles.menuButtonWrapper, menuButtonAnimation]}>
              <TouchableOpacity style={[styles.menuButton, styles.friendsButton]} onPress={() => { toggleMenu(); router.push("/AddFriends"); }}>
                <Text style={styles.menuButtonIcon}>🤝</Text>
                <Text style={styles.menuButtonLabel}>Ket Ban</Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={[styles.menuButtonWrapper, menuButtonAnimation]}>
              <TouchableOpacity style={[styles.menuButton, styles.fundButton]} onPress={() => { toggleMenu(); router.push("/Messages"); }}>
                <Text style={styles.menuButtonIcon}>🗨️</Text>
                <Text style={styles.menuButtonLabel}>Tin Nhan</Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={[styles.menuButtonWrapper, menuButtonAnimation]}>
              <TouchableOpacity style={[styles.menuButton, styles.fundButton]} onPress={() => { toggleMenu(); router.push("/GroupFunds"); }}>
                <Text style={styles.menuButtonIcon}>💵</Text>
                <Text style={styles.menuButtonLabel}>Quy Chung</Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={[styles.menuButtonWrapper, menuButtonAnimation]}>
              <TouchableOpacity style={[styles.menuButton, styles.piggyButton]} onPress={() => { toggleMenu(); router.push("/HeoDat"); }}>
                <Text style={styles.menuButtonIcon}>🐖</Text>
                <Text style={styles.menuButtonLabel}>Heo Dat</Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={[styles.menuButtonWrapper, menuButtonAnimation]}>
              <TouchableOpacity style={[styles.menuButton, styles.statsButton]} onPress={() => { toggleMenu(); router.push("/statistics"); }}>
                <Text style={styles.menuButtonIcon}>📈</Text>
                <Text style={styles.menuButtonLabel}>Thong ke</Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={[styles.menuButtonWrapper, menuButtonAnimation]}>
              <TouchableOpacity style={[styles.menuButton, styles.excelButton]} onPress={() => { toggleMenu(); exportToExcel(transactions); }}>
                <Text style={styles.menuButtonIcon}>📩</Text>
                <Text style={styles.menuButtonLabel}>Xuat Excel</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
        <TouchableOpacity style={[styles.mainMenuButton, menuVisible && styles.mainMenuButtonActive]} onPress={toggleMenu}>
          <Text style={styles.mainMenuIcon}>📋</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.floatingButton, styles.addButton]} onPress={() => router.push("/add-transaction")}>
          <Text style={styles.addIcon}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Bank connection toast - minimized corner notification */}
      {bankToastVisible && !bankConnected && (
        <View style={styles.bankToast}>
          <View style={styles.bankToastContent}>
            <Text style={styles.bankToastIcon}>🏦</Text>
            <View style={styles.bankToastTextContainer}>
              <Text style={styles.bankToastTitle}>Ket noi ngan hang</Text>
              <Text style={styles.bankToastSub}>Tu dong dong bo giao dich</Text>
            </View>
          </View>
          <View style={styles.bankToastActions}>
            <TouchableOpacity style={styles.bankToastConnect} onPress={connectBank}>
              <Text style={styles.bankToastConnectText}>Ket noi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bankToastDismiss} onPress={dismissBankToast}>
              <Text style={styles.bankToastDismissText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fffafc" },

  // Header
  header: {
    backgroundColor: '#fff0f5',
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
  headerContent: { padding: 24, paddingTop: 50 },

  // CSKH button
  cskhButton: {
    position: 'absolute',
    top: 10,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#4facfe',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  cskhIcon: { fontSize: 14, marginRight: 4 },
  cskhText: { fontSize: 11, color: '#4facfe', fontWeight: '700' },

  // Profile button
  profileButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  profileIcon: { fontSize: 14, marginRight: 4 },
  profileText: { fontSize: 11, color: '#ff6b9d', fontWeight: '600' },

  welcomeText: { fontSize: 16, color: '#ff6b9d', marginBottom: 8, fontWeight: '500' },
  balanceLabel: { fontSize: 14, color: '#ff9ec6', marginBottom: 4, fontWeight: '500' },
  balance: { fontSize: 36, fontWeight: 'bold', marginBottom: 24 },
  incomeExpenseContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  incomeExpenseItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
    marginRight: 12, shadowColor: '#ff9ec6', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  iconText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  incomeExpenseLabel: { fontSize: 12, color: '#ff6b9d', marginBottom: 2, fontWeight: '500' },
  incomeExpenseAmount: { fontSize: 16, fontWeight: '600', color: '#d63384' },

  // Transaction Section
  transactionSection: { flex: 1, paddingHorizontal: 16 },
  sectionHeaderMain: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12, marginTop: 8,
  },
  sectionTitleMain: { fontSize: 20, fontWeight: 'bold', color: '#d63384' },
  transactionCount: { fontSize: 12, color: '#ff9ec6', fontWeight: '500' },
  listContent: { paddingBottom: 120 },

  // Bank section
  bankSection: {
    backgroundColor: '#f0f8ff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d6eaf8',
  },
  bankSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bankSectionTitle: { fontSize: 14, fontWeight: '700', color: '#2980b9' },
  syncButtonSmall: {
    backgroundColor: '#4facfe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  syncButtonSmallText: { fontSize: 11, fontWeight: '600', color: 'white' },
  bankTransactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    marginVertical: 3,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8f0fe',
  },
  bankItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  bankIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#e8f0fe',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  bankIconText: { fontSize: 16 },
  bankItemInfo: { flex: 1 },
  bankItemCategory: { fontSize: 14, fontWeight: '600', color: '#2c3e50' },
  bankItemNote: { fontSize: 12, color: '#7f8c8d', marginTop: 1 },
  bankItemDate: { fontSize: 10, color: '#95a5a6', marginTop: 2 },
  bankItemRight: { alignItems: 'flex-end' },
  bankItemAmount: { fontSize: 14, fontWeight: 'bold' },

  // Manual section header
  manualSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  manualSectionTitle: { fontSize: 14, fontWeight: '700', color: '#d63384' },
  manualCount: { fontSize: 12, color: '#ff9ec6', fontWeight: '500' },

  // Section Header
  sectionHeader: { marginTop: 16, marginBottom: 8 },
  sectionHeaderContent: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: {
    fontSize: 14, fontWeight: 'bold', color: '#ff6b9d', marginRight: 12,
    backgroundColor: '#fff0f5', paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 12, overflow: 'hidden',
  },
  sectionLine: { flex: 1, height: 2, backgroundColor: '#ffd6e7', borderRadius: 1 },

  // Transaction Item
  transactionItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'white', marginVertical: 6, padding: 16, borderRadius: 20,
    shadowColor: '#ff9ec6', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
    borderWidth: 1, borderColor: '#fff0f5',
  },
  transactionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  typeIndicator: {
    width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, marginRight: 12, shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2,
    shadowRadius: 3, elevation: 2,
  },
  typeIcon: { fontSize: 20 },
  transactionInfo: { flex: 1 },
  category: { fontSize: 16, fontWeight: '600', color: '#d63384', marginBottom: 2 },
  note: { fontSize: 13, color: '#ff6b9d', marginBottom: 4 },
  date: { fontSize: 11, color: '#ff9ec6', fontWeight: '500' },
  transactionRight: { alignItems: 'flex-end' },
  amount: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  typeBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    shadowColor: '#ff9ec6', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3, shadowRadius: 2, elevation: 2,
  },
  typeBadgeText: { fontSize: 10, color: 'white', fontWeight: 'bold' },
  autoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#4facfe' },
  autoBadgeText: { fontSize: 9, color: 'white', fontWeight: 'bold' },

  // Empty State
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 18, color: '#ff6b9d', fontWeight: '600', marginBottom: 8 },
  emptySubText: { fontSize: 14, color: '#ff9ec6', textAlign: 'center', fontWeight: '500' },
  loginButton: {
    backgroundColor: '#ff6b9d', paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 20, marginTop: 16,
  },
  loginButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },

  // Floating Buttons & Menu
  buttonContainer: { position: 'absolute', right: 20, bottom: 20, alignItems: 'flex-end' },
  menuContainer: { position: 'absolute', bottom: 70, right: 0, alignItems: 'flex-end' },
  menuButtonWrapper: { marginBottom: 10 },
  menuButton: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  friendsButton: { backgroundColor: '#aedfff' },
  fundButton: { backgroundColor: '#ffd8a8' },
  piggyButton: { backgroundColor: '#ffb6c1' },
  statsButton: { backgroundColor: '#d8bfd8' },
  excelButton: { backgroundColor: '#98fb98' },
  menuButtonIcon: { fontSize: 16, marginRight: 6 },
  menuButtonLabel: { fontSize: 12, fontWeight: '600', color: '#333' },
  mainMenuButton: {
    backgroundColor: '#ff6b9d', width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#ff6b9d', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 12, marginBottom: 15,
  },
  mainMenuButtonActive: { backgroundColor: '#d63384', transform: [{ rotate: '45deg' }] },
  mainMenuIcon: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  floatingButton: {
    shadowColor: '#ff6b9d', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  addButton: {
    backgroundColor: '#ff6b9d', width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#ff6b9d', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 12,
  },
  addIcon: { color: 'white', fontSize: 24, fontWeight: '200' },

  // Bank toast - minimized corner notification
  bankToast: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#4facfe',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#d6eaf8',
  },
  bankToastContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bankToastIcon: { fontSize: 24, marginRight: 10 },
  bankToastTextContainer: { flex: 1 },
  bankToastTitle: { fontSize: 14, fontWeight: '700', color: '#2c3e50' },
  bankToastSub: { fontSize: 12, color: '#7f8c8d', marginTop: 2 },
  bankToastActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bankToastConnect: {
    backgroundColor: '#4facfe', paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 12,
  },
  bankToastConnectText: { color: 'white', fontWeight: '700', fontSize: 13 },
  bankToastDismiss: { padding: 8 },
  bankToastDismissText: { fontSize: 16, color: '#bdc3c7', fontWeight: '600' },
});
>>>>>>> d8bd37f (Sua cac trang blank, them nut back len moi trang, verify email khi dang ky, them chuc nang lien ket va theo doi bien dong ngan hang (chua test),...)
