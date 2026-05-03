import { StyleSheet, Text, View } from 'react-native';

export default function Chatscreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Chat screen - use Messages instead</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fffafc' },
  text: { color: '#ff6b9d', fontSize: 16 },
});
