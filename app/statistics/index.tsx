import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LineChart, PieChart } from "react-native-chart-kit";
import { auth, db } from "../../firebase";

export default function StatisticsScreen() {
  const [data, setData] = useState<any[]>([]);
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState<number[]>([]);
  const [monthlyExpense, setMonthlyExpense] = useState<number[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const screenWidth = Dimensions.get("window").width;

  // Theo dõi trạng thái đăng nhập
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // ✅ SỬA: Truy cập theo đường dẫn users/{uid}/transactions
        const transactionsRef = collection(db, "users", user.uid, "transactions");
        const snapshot = await getDocs(transactionsRef);
        
        const list = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            amount: data.amount,
            type: data.type,
            createdAt: data.createdAt,
          };
        });

        console.log("📊 Dữ liệu giao dịch:", list.length, "giao dịch");

        const totalIncome = list
          .filter((t) => t.type === "Thu nhập")
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        const totalExpense = list
          .filter((t) => t.type === "Chi tiêu")
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        const chartData = [
          {
            name: "Chi tiêu",
            population: totalExpense,
            color: "#ff80ab",
            legendFontColor: "#333",
            legendFontSize: 14,
          },
          {
            name: "Thu nhập",
            population: totalIncome,
            color: "#f8bbd0",
            legendFontColor: "#333",
            legendFontSize: 14,
          },
        ];

        // Biểu đồ theo tháng
        const monthlyIncomeData = Array(12).fill(0);
        const monthlyExpenseData = Array(12).fill(0);

        list.forEach((t) => {
          let transactionDate: Date;
          
          if (t.createdAt && t.createdAt.toDate) {
            transactionDate = t.createdAt.toDate();
          } else if (t.createdAt && typeof t.createdAt === 'string') {
            transactionDate = new Date(t.createdAt);
          } else {
            transactionDate = new Date();
          }

          const month = transactionDate.getMonth(); // 0-11 (Jan-Dec)
          
          if (t.type === "Thu nhập") {
            monthlyIncomeData[month] += t.amount || 0;
          } else if (t.type === "Chi tiêu") {
            monthlyExpenseData[month] += t.amount || 0;
          }
        });

        console.log("📈 Thu nhập theo tháng:", monthlyIncomeData);
        console.log("📉 Chi tiêu theo tháng:", monthlyExpenseData);

        setMonthlyIncome(monthlyIncomeData);
        setMonthlyExpense(monthlyExpenseData);
        setData(chartData);
        setIncome(totalIncome);
        setExpense(totalExpense);
      } catch (error) {
        console.error("❌ Lỗi khi tải thống kê:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [user]);

  // Hiển thị màn hình chờ đăng nhập
  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>💗 Thống kê tài chính</Text>
          <Text style={styles.subtitle}>Vui lòng đăng nhập để xem thống kê</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🔐</Text>
          <Text style={styles.emptyText}>Chưa đăng nhập</Text>
          <Text style={styles.emptySubText}>Đăng nhập để xem thống kê của bạn</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>💗 Thống kê tài chính</Text>
          <Text style={styles.subtitle}>Đang tải dữ liệu...</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyText}>Đang tải thống kê</Text>
          <Text style={styles.emptySubText}>Vui lòng chờ trong giây lát</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.title}>💗 Thống kê tài chính</Text>
        <Text style={styles.subtitle}>
          Theo dõi thu nhập & chi tiêu hàng tháng của bạn
        </Text>
      </View>

      {/* --- Tổng quan thu chi --- */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.label}>Tổng thu nhập:</Text>
          <Text style={[styles.value, { color: "#e91e63" }]}>
            +{income.toLocaleString()} đ
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.label}>Tổng chi tiêu:</Text>
          <Text style={[styles.value, { color: "#f06292" }]}>
            -{expense.toLocaleString()} đ
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.label}>Số dư hiện tại:</Text>
          <Text style={[styles.value, { color: income - expense >= 0 ? "#ad1457" : "#ff4757" }]}>
            {(income - expense).toLocaleString()} đ
          </Text>
        </View>
      </View>

      {/* --- Biểu đồ PieChart --- */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>🍩 Tỷ lệ thu - chi</Text>
        {data.length > 0 && (income > 0 || expense > 0) ? (
          <PieChart
            data={data}
            width={screenWidth - 40}
            height={240}
            chartConfig={{
              backgroundGradientFrom: "#fff0f5",
              backgroundGradientTo: "#fff0f5",
              color: (opacity = 1) => `rgba(233, 30, 99, ${opacity})`,
              strokeWidth: 2,
            }}
            accessor={"population"}
            backgroundColor={"transparent"}
            paddingLeft={"15"}
            absolute
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💸</Text>
            <Text style={styles.emptyText}>Chưa có dữ liệu giao dịch</Text>
            <Text style={styles.emptySubText}>Hãy thêm giao dịch đầu tiên</Text>
          </View>
        )}
      </View>

      {/* --- Biểu đồ LineChart --- */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>📈 Biểu đồ theo tháng</Text>
        {monthlyIncome.some(month => month > 0) || monthlyExpense.some(month => month > 0) ? (
          <LineChart
            data={{
              labels: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"],
              datasets: [
                {
                  data: monthlyIncome,
                  color: () => "#ec407a",
                  strokeWidth: 3,
                },
                {
                  data: monthlyExpense,
                  color: () => "#f8bbd0",
                  strokeWidth: 3,
                },
              ],
              legend: ["Thu nhập", "Chi tiêu"],
            }}
            width={screenWidth - 40}
            height={240}
            yAxisLabel=""
            yAxisSuffix="đ"
            chartConfig={{
              backgroundGradientFrom: "#fff0f5",
              backgroundGradientTo: "#fff0f5",
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(233, 30, 99, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(100, 100, 100, ${opacity})`,
              propsForDots: {
                r: "5",
                strokeWidth: "2",
                stroke: "#f48fb1",
              },
            }}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyText}>Chưa có dữ liệu theo tháng</Text>
            <Text style={styles.emptySubText}>Giao dịch sẽ hiển thị theo tháng</Text>
          </View>
        )}
      </View>

      {/* --- Gợi ý quản lý --- */}
      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>🌸 Gợi ý quản lý tài chính</Text>
        <Text style={styles.tipText}>
          • Giữ chi tiêu dưới 60% thu nhập mỗi tháng.
        </Text>
        <Text style={styles.tipText}>
          • Tiết kiệm ít nhất 20% thu nhập để dự phòng.
        </Text>
        <Text style={styles.tipText}>
          • Theo dõi thường xuyên để điều chỉnh hợp lý.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff5f8" },
  header: { 
    alignItems: "center", 
    marginTop: 25, 
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#e91e63" },
  subtitle: { fontSize: 14, color: "#777", marginTop: 4, textAlign: "center" },

  summaryCard: {
    backgroundColor: "#ffffff",
    margin: 15,
    padding: 18,
    borderRadius: 20,
    shadowColor: "#e91e63",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 6,
  },
  label: { fontSize: 16, color: "#333" },
  value: { fontSize: 16, fontWeight: "bold" },
  divider: {
    borderBottomColor: "#f8bbd0",
    borderBottomWidth: 1,
    marginVertical: 10,
  },

  chartCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 15,
    padding: 18,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#f48fb1",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 15,
    minHeight: 300,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ad1457",
    marginBottom: 10,
  },
  
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#e91e63',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#ff9ec6',
    textAlign: 'center',
  },

  tipCard: {
    backgroundColor: "#fce4ec",
    margin: 15,
    padding: 18,
    borderRadius: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#ec407a",
    marginBottom: 30,
  },
  tipTitle: {
    fontWeight: "bold",
    color: "#ad1457",
    fontSize: 16,
    marginBottom: 6,
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
  tipText: { color: "#444", fontSize: 14, marginVertical: 2 },
});