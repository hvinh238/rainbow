<<<<<<< HEAD
=======
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
>>>>>>> d8bd37f (Sua cac trang blank, them nut back len moi trang, verify email khi dang ky, them chuc nang lien ket va theo doi bien dong ngan hang (chua test),...)
import { Stack } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { auth } from "../firebase"; // 🔹 import auth từ firebase.ts
import { theme } from "../styles/theme";

export default function RootLayout() {
<<<<<<< HEAD
=======
  useFrameworkReady();
>>>>>>> d8bd37f (Sua cac trang blank, them nut back len moi trang, verify email khi dang ky, them chuc nang lien ket va theo doi bien dong ngan hang (chua test),...)
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ✅ Theo dõi trạng thái đăng nhập Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe; // cleanup khi component unmount
  }, []);

  if (loading) {
    return (
      <View style={[theme.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#ff6b9d" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* 🔹 Trang login sẽ hiển thị đầu tiên nếu chưa đăng nhập */}
      {!user ? (
        <>
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
        </>
      ) : (
        <>
          <Stack.Screen
            name="index"
            options={{
              headerShown: true,
              title: "MoneyMeow 🐱ྀིྀི",
            }}
          />
<<<<<<< HEAD
=======
          <Stack.Screen
            name="profile"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="HeoDat"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="GroupFunds"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="AddFriends"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="MessagesScreen"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="Chatscreen"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="CSKH"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="add-transaction"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="statistics/index"
            options={{
              headerShown: false,
            }}
          />
>>>>>>> d8bd37f (Sua cac trang blank, them nut back len moi trang, verify email khi dang ky, them chuc nang lien ket va theo doi bien dong ngan hang (chua test),...)
        </>
      )}
    </Stack>
  );
}
