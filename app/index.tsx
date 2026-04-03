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
