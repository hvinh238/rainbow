<<<<<<< HEAD
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../firebase';

interface Fund {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  createdBy: string;
  members: string[];
  description: string;
  createdAt: any;
  memberPercentages?: {[userId: string]: number};
  pendingWithdrawals?: PendingWithdrawal[];
}

interface User {
  id: string;
  email: string;
  name?: string;
}

interface FundContribution {
  userId: string;
  amount: number;
  userName?: string;
  userEmail?: string;
}

interface FundWithdrawal {
  userId: string;
  amount: number;
  userName?: string;
  reason?: string;
  createdAt?: any;
  type?: 'normal' | 'emergency' | 'approved';
  status?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string[];
}

interface PendingWithdrawal {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  reason: string;
  createdAt: any;
  approvedBy: string[];
  neededApprovals: number;
}

interface MemberContribution {
  userId: string;
  userName: string;
  userEmail: string;
  netAmount: number;
  color: string;
  percentage: number;
}

interface BankAccount {
  id: string;
  balance: number;
}

const GroupFunds: React.FC = () => {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [fundName, setFundName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [memberPercentages, setMemberPercentages] = useState<{[userId: string]: number}>({});
  const [memberContributions, setMemberContributions] = useState<{[fundId: string]: MemberContribution[]}>({});
  const [withdrawals, setWithdrawals] = useState<{[fundId: string]: FundWithdrawal[]}>({});
  const [allUsers, setAllUsers] = useState<{[userId: string]: User}>({});
  const [loadingFunds, setLoadingFunds] = useState<{[fundId: string]: boolean}>({});
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [selectedFund, setSelectedFund] = useState<Fund | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawType, setWithdrawType] = useState<'emergency' | 'normal'>('normal');

  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [fundToAddMembers, setFundToAddMembers] = useState<Fund | null>(null);
  const [newMemberPercentages, setNewMemberPercentages] = useState<{[userId: string]: number}>({});

  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<{[fundId: string]: PendingWithdrawal[]}>({});

  const [editPercentageModalVisible, setEditPercentageModalVisible] = useState(false);
  const [fundToEditPercentages, setFundToEditPercentages] = useState<Fund | null>(null);
  const [editingPercentages, setEditingPercentages] = useState<{[userId: string]: number}>({});

  const loadBankAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const bankRef = collection(db, "users", user.uid, "bankAccount");
      const bankSnapshot = await getDocs(bankRef);
      
      if (bankSnapshot.empty) {
        const newBankAccount = {
          balance: 0,
          createdAt: new Date(),
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
      console.error('Lỗi tải số dư tài khoản:', error);
    }
  };

  const updateBankBalance = async (newBalance: number) => {
    const user = auth.currentUser;
    if (!user || !bankAccount) return;

    try {
      const bankRef = doc(db, "users", user.uid, "bankAccount", bankAccount.id);
      await updateDoc(bankRef, { balance: newBalance });
      setBankAccount({ ...bankAccount, balance: newBalance });
    } catch (error) {
      console.error('Lỗi khi cập nhật số dư:', error);
      Alert.alert("Lỗi", "Không thể cập nhật số dư!");
    }
  };

  const loadFriends = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const friendIds = userData.friends || [];
        
        const friendsList: User[] = [];
        const usersMap: {[userId: string]: User} = {};
        
        for (const friendId of friendIds) {
          const friendRef = doc(db, 'users', friendId);
          const friendSnap = await getDoc(friendRef);
          if (friendSnap.exists()) {
            const friendData = friendSnap.data();
            const userInfo: User = { 
              id: friendId, 
              email: friendData.email || '',
              name: friendData.name || friendData.email?.split('@')[0] || 'User'
            };
            friendsList.push(userInfo);
            usersMap[friendId] = userInfo;
          }
        }
        
        const currentUserInfo: User = {
          id: user.uid,
          email: user.email || '',
          name: user.displayName || user.email?.split('@')[0] || 'You'
        };
        usersMap[user.uid] = currentUserInfo;
        
        setFriends(friendsList);
        setAllUsers(prev => ({ ...prev, ...usersMap }));
      }
    } catch (error) {
      console.error('Lỗi tải danh sách bạn:', error);
    }
  };

  const loadFunds = () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const fundsRef = collection(db, 'groupFunds');
      const q = query(fundsRef, where('members', 'array-contains', user.uid));
      
      return onSnapshot(q, async (snapshot) => {
        const fundsData = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || '',
          targetAmount: doc.data().targetAmount || 0,
          currentAmount: doc.data().currentAmount || 0,
          createdBy: doc.data().createdBy || '',
          members: doc.data().members || [],
          description: doc.data().description || '',
          createdAt: doc.data().createdAt,
          memberPercentages: doc.data().memberPercentages || {},
          pendingWithdrawals: doc.data().pendingWithdrawals || [],
        })) as Fund[];
        
        setFunds(fundsData);

        for (const fund of fundsData) {
          await loadFundData(fund.id);
          await loadPendingWithdrawals(fund.id);
        }
      });
    } catch (error) {
      console.error('Lỗi tải quỹ:', error);
      return undefined;
    }
  };

  const getUserInfo = async (userId: string): Promise<User> => {
    try {
      if (allUsers[userId]) {
        return allUsers[userId];
      }

      const friend = friends.find(f => f.id === userId);
      if (friend) {
        return friend;
      }

      if (userId === auth.currentUser?.uid) {
        const currentUser = auth.currentUser;
        return {
          id: userId,
          email: currentUser.email || '',
          name: currentUser.displayName || currentUser.email?.split('@')[0] || 'You'
        };
      }

      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const userInfo: User = {
          id: userId,
          email: userData.email || '',
          name: userData.name || userData.email?.split('@')[0] || 'User'
        };
        
        setAllUsers(prev => ({ ...prev, [userId]: userInfo }));
        return userInfo;
      }

      const defaultUser: User = {
        id: userId,
        email: 'Unknown',
        name: 'User'
      };
      return defaultUser;
    } catch (error) {
      console.error('Lỗi lấy thông tin user:', error);
      return {
        id: userId,
        email: 'Unknown',
        name: 'User'
      };
    }
  };

  const getMemberColor = (index: number) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#FFA726', '#AB47BC', '#26A69A', '#42A5F5', '#7E57C2'
    ];
    return colors[index % colors.length];
  };

  const loadFundData = async (fundId: string) => {
    try {
      const contributionsRef = collection(db, 'fundContributions');
      const contributionsQuery = query(contributionsRef, where('fundId', '==', fundId));
      const contributionsSnapshot = await getDocs(contributionsQuery);
      
      const contributions = contributionsSnapshot.docs.map(doc => doc.data() as FundContribution);

      const withdrawalsRef = collection(db, 'fundWithdrawals');
      const withdrawalsQuery = query(withdrawalsRef, where('fundId', '==' , fundId));
      const withdrawalsSnapshot = await getDocs(withdrawalsQuery);
      
      const withdrawalsData = await Promise.all(
        withdrawalsSnapshot.docs.map(async (doc) => {
          const data = doc.data();
          const userInfo = await getUserInfo(data.userId);
          return {
            userId: data.userId,
            amount: data.amount,
            userName: userInfo.name,
            reason: data.reason,
            createdAt: data.createdAt,
            type: data.type || 'normal',
            status: data.status,
            approvedBy: data.approvedBy || [],
          } as FundWithdrawal;
        })
      );

      setWithdrawals(prev => ({
        ...prev,
        [fundId]: withdrawalsData
      }));

      const userNetContributions: {[userId: string]: number} = {};
      
      contributions.forEach(contribution => {
        userNetContributions[contribution.userId] = 
          (userNetContributions[contribution.userId] || 0) + contribution.amount;
      });

      withdrawalsData.forEach(withdrawal => {
        if (withdrawal.status !== 'rejected') {
          userNetContributions[withdrawal.userId] = 
            (userNetContributions[withdrawal.userId] || 0) - withdrawal.amount;
        }
      });

      const memberContributionsArray: MemberContribution[] = [];
      const userIds = Object.keys(userNetContributions);
      
      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        const userInfo = await getUserInfo(userId);
        const netAmount = userNetContributions[userId];
        
        if (netAmount > 0) {
          memberContributionsArray.push({
            userId,
            userName: userInfo.name || userInfo.email.split('@')[0] || 'User',
            userEmail: userInfo.email,
            netAmount,
            color: getMemberColor(i),
            percentage: 0
          });
        }
      }

      memberContributionsArray.sort((a, b) => b.netAmount - a.netAmount);

      const totalNetAmount = memberContributionsArray.reduce((sum, member) => sum + member.netAmount, 0);
      if (totalNetAmount > 0) {
        memberContributionsArray.forEach(member => {
          member.percentage = (member.netAmount / totalNetAmount) * 100;
        });
      }

      setMemberContributions(prev => ({
        ...prev,
        [fundId]: memberContributionsArray
      }));
    } catch (error) {
      console.error('Lỗi tính toán dữ liệu quỹ:', error);
    }
  };

  const loadPendingWithdrawals = async (fundId: string) => {
    try {
      const withdrawalsRef = collection(db, 'fundWithdrawals');
      const withdrawalsQuery = query(
        withdrawalsRef, 
        where('fundId', '==', fundId),
        where('status', '==', 'pending')
      );
      const withdrawalsSnapshot = await getDocs(withdrawalsQuery);
      
      const pendingWithdrawalsData = await Promise.all(
        withdrawalsSnapshot.docs.map(async (doc) => {
          const data = doc.data();
          const userInfo = await getUserInfo(data.userId);
          return {
            id: doc.id,
            userId: data.userId,
            userName: userInfo.name,
            amount: data.amount,
            reason: data.reason,
            createdAt: data.createdAt,
            approvedBy: data.approvedBy || [],
            neededApprovals: data.neededApprovals || 1,
          } as PendingWithdrawal;
        })
      );

      setPendingWithdrawals(prev => ({
        ...prev,
        [fundId]: pendingWithdrawalsData
      }));
    } catch (error) {
      console.error('Lỗi tải yêu cầu rút tiền:', error);
    }
  };

  useEffect(() => {
    loadFriends();
    loadBankAccount();
    const unsubscribe = loadFunds();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const updateMemberPercentage = (userId: string, percentage: number) => {
    setMemberPercentages(prev => ({
      ...prev,
      [userId]: percentage
    }));
  };

  const updateNewMemberPercentage = (userId: string, percentage: number) => {
    setNewMemberPercentages(prev => ({
      ...prev,
      [userId]: percentage
    }));
  };

  const updateEditingPercentage = (userId: string, percentage: number) => {
    setEditingPercentages(prev => ({
      ...prev,
      [userId]: percentage
    }));
  };

  const getTotalPercentage = (percentages: {[userId: string]: number}) => {
    return Object.values(percentages).reduce((sum, percentage) => sum + percentage, 0);
  };

  const createFund = async () => {
    const user = auth.currentUser;
    if (!user || !fundName || !targetAmount) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên quỹ và số tiền mục tiêu!');
      return;
    }

    const allPercentages = {
      [user.uid]: memberPercentages[user.uid] || 0,
      ...memberPercentages
    };

    const totalPercentage = getTotalPercentage(allPercentages);
    
    if (totalPercentage !== 100) {
      Alert.alert('Lỗi', `Tổng phần trăm phải bằng 100%! Hiện tại: ${totalPercentage}%`);
      return;
    }

    try {
      const members = [user.uid, ...selectedFriends];
      
      await addDoc(collection(db, 'groupFunds'), {
        name: fundName,
        targetAmount: Number(targetAmount),
        currentAmount: 0,
        createdBy: user.uid,
        members: members,
        description: description,
        memberPercentages: allPercentages,
        createdAt: new Date(),
        pendingWithdrawals: [],
      });

      Alert.alert('Thành công', 'Đã tạo quỹ mới!');
      setFundName('');
      setTargetAmount('');
      setDescription('');
      setSelectedFriends([]);
      setMemberPercentages({});
    } catch (error) {
      console.error('Lỗi tạo quỹ:', error);
      Alert.alert('Lỗi', 'Không thể tạo quỹ!');
    }
  };

  const addMembersToFund = async () => {
    if (!fundToAddMembers) return;

    const totalCurrentPercentage = getTotalPercentage(fundToAddMembers.memberPercentages || {});
    const totalNewPercentage = getTotalPercentage(newMemberPercentages);
    const combinedTotal = totalCurrentPercentage + totalNewPercentage;

    if (combinedTotal !== 100) {
      Alert.alert('Lỗi', `Tổng phần trăm phải bằng 100%! Hiện tại: ${combinedTotal}%`);
      return;
    }

    try {
      const fundRef = doc(db, 'groupFunds', fundToAddMembers.id);
      
      const updatedMemberPercentages = {
        ...fundToAddMembers.memberPercentages,
        ...newMemberPercentages
      };

      await updateDoc(fundRef, {
        members: arrayUnion(...Object.keys(newMemberPercentages)),
        memberPercentages: updatedMemberPercentages
      });

      Alert.alert('Thành công', 'Đã thêm thành viên vào quỹ!');
      setAddMemberModalVisible(false);
      setNewMemberPercentages({});
      setFundToAddMembers(null);
    } catch (error) {
      console.error('Lỗi thêm thành viên:', error);
      Alert.alert('Lỗi', 'Không thể thêm thành viên!');
    }
  };

  const kickMember = async (fundId: string, memberId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const fund = funds.find(f => f.id === fundId);
    if (!fund) return;

    if (fund.createdBy !== user.uid) {
      Alert.alert('Lỗi', 'Chỉ chủ quỹ mới có thể xóa thành viên!');
      return;
    }

    if (memberId === user.uid) {
      Alert.alert('Lỗi', 'Bạn không thể xóa chính mình khỏi quỹ!');
      return;
    }

    Alert.alert(
      'Xác nhận xóa thành viên',
      `Bạn có chắc muốn xóa ${getUserDisplayName(memberId)} khỏi quỹ?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const fundRef = doc(db, 'groupFunds', fundId);
              
              await updateDoc(fundRef, {
                members: arrayRemove(memberId),
              });

              Alert.alert('Thành công', `Đã xóa ${getUserDisplayName(memberId)} khỏi quỹ!`);
            } catch (error) {
              console.error('Lỗi xóa thành viên:', error);
              Alert.alert('Lỗi', 'Không thể xóa thành viên!');
            }
          },
        },
      ]
    );
  };

  const openEditPercentageModal = (fund: Fund) => {
    setFundToEditPercentages(fund);
    
    const initialPercentages: {[userId: string]: number} = {};
    fund.members.forEach(memberId => {
      initialPercentages[memberId] = fund.memberPercentages?.[memberId] || 0;
    });
    
    setEditingPercentages(initialPercentages);
    setEditPercentageModalVisible(true);
  };

  const saveEditedPercentages = async () => {
    if (!fundToEditPercentages) return;

    const completePercentages: {[userId: string]: number} = {};
    fundToEditPercentages.members.forEach(memberId => {
      completePercentages[memberId] = editingPercentages[memberId] || 0;
    });

    const totalPercentage = getTotalPercentage(completePercentages);
    
    if (totalPercentage !== 100) {
      Alert.alert('Lỗi', `Tổng phần trăm phải bằng 100%! Hiện tại: ${totalPercentage}%`);
      return;
    }

    try {
      const fundRef = doc(db, 'groupFunds', fundToEditPercentages.id);
      
      await updateDoc(fundRef, {
        memberPercentages: completePercentages
      });

      Alert.alert('Thành công', 'Đã cập nhật phân bổ phần trăm!');
      setEditPercentageModalVisible(false);
      setFundToEditPercentages(null);
      setEditingPercentages({});
    } catch (error) {
      console.error('Lỗi cập nhật phần trăm:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật phần trăm!');
    }
  };

  const openAddMemberModal = (fund: Fund) => {
    setFundToAddMembers(fund);
    setNewMemberPercentages({});
    setAddMemberModalVisible(true);
  };

  const openApprovalModal = (fund: Fund) => {
    setSelectedFund(fund);
    setApprovalModalVisible(true);
  };

  const contributeToFund = async (fundId: string, amount: number) => {
    const user = auth.currentUser;
    if (!user) return;

    if (!bankAccount || bankAccount.balance < amount) {
      Alert.alert('Lỗi', `Không đủ tiền trong tài khoản! Số dư hiện tại: ${bankAccount?.balance.toLocaleString() || 0}đ`);
      return;
    }

    setLoadingFunds(prev => ({ ...prev, [fundId]: true }));

    try {
      const fundRef = doc(db, 'groupFunds', fundId);
      
      const fundSnap = await getDoc(fundRef);
      if (!fundSnap.exists()) {
        Alert.alert('Lỗi', 'Quỹ không tồn tại!');
        return;
      }

      const fundData = fundSnap.data();
      const newAmount = (fundData.currentAmount || 0) + amount;
      
      await updateDoc(fundRef, {
        currentAmount: newAmount,
      });

      await addDoc(collection(db, 'fundContributions'), {
        fundId,
        userId: user.uid,
        amount,
        createdAt: new Date(),
      });

      const newBankBalance = bankAccount.balance - amount;
      await updateBankBalance(newBankBalance);

      setFunds(prevFunds => 
        prevFunds.map(fund => 
          fund.id === fundId 
            ? { ...fund, currentAmount: newAmount }
            : fund
        )
      );

      await loadFundData(fundId);

      Alert.alert('Thành công', `Đã đóng góp ${amount.toLocaleString()}đ vào quỹ từ tài khoản của bạn!`);
    } catch (error) {
      console.error('Lỗi đóng góp:', error);
      Alert.alert('Lỗi', 'Không thể đóng góp!');
    } finally {
      setLoadingFunds(prev => ({ ...prev, [fundId]: false }));
    }
  };

  const withdrawFromFund = async () => {
    const user = auth.currentUser;
    if (!user || !selectedFund) return;

    const amount = Number(withdrawAmount);
    
    if (!amount || amount <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ!');
      return;
    }

    if (!withdrawReason.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập lý do rút quỹ!');
      return;
    }

    if (amount > selectedFund.currentAmount) {
      Alert.alert('Lỗi', `Số tiền rút không được vượt quá ${selectedFund.currentAmount.toLocaleString()}đ trong quỹ!`);
      return;
    }

    const isCreator = selectedFund.createdBy === user.uid;
    
    if (isCreator) {
      await processWithdrawal(selectedFund.id, amount, withdrawReason, 'normal');
    } else {
      if (withdrawType === 'emergency') {
        const maxEmergencyAmount = selectedFund.currentAmount * 0.2;
        if (amount > maxEmergencyAmount) {
          Alert.alert('Lỗi', `Rút khẩn cấp chỉ được tối đa ${maxEmergencyAmount.toLocaleString()}đ (20% số dư quỹ)!`);
          return;
        }
        await processWithdrawal(selectedFund.id, amount, withdrawReason, 'emergency');
      } else {
        await requestWithdrawalApproval(selectedFund.id, amount, withdrawReason);
      }
    }
  };

  const processWithdrawal = async (fundId: string, amount: number, reason: string, type: 'normal' | 'emergency') => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const fundRef = doc(db, 'groupFunds', fundId);
      
      const fundSnap = await getDoc(fundRef);
      if (!fundSnap.exists()) {
        Alert.alert('Lỗi', 'Quỹ không tồn tại!');
        return;
      }

      const fundData = fundSnap.data();
      const newAmount = (fundData.currentAmount || 0) - amount;
      
      await updateDoc(fundRef, {
        currentAmount: newAmount,
      });

      const userInfo = await getUserInfo(user.uid);
      await addDoc(collection(db, 'fundWithdrawals'), {
        fundId: fundId,
        userId: user.uid,
        userName: userInfo.name,
        amount: amount,
        reason: reason,
        type: type,
        status: 'approved',
        createdAt: new Date(),
      });

      const newBankBalance = (bankAccount?.balance || 0) + amount;
      await updateBankBalance(newBankBalance);

      setFunds(prevFunds => 
        prevFunds.map(fund => 
          fund.id === fundId 
            ? { ...fund, currentAmount: newAmount }
            : fund
        )
      );

      await loadFundData(fundId);

      setWithdrawModalVisible(false);
      setWithdrawAmount('');
      setWithdrawReason('');
      setSelectedFund(null);

      Alert.alert('Thành công', `Đã rút ${amount.toLocaleString()}đ từ quỹ! Tiền đã được chuyển vào tài khoản của bạn.`);
    } catch (error) {
      console.error('Lỗi rút quỹ:', error);
      Alert.alert('Lỗi', 'Không thể rút quỹ!');
    }
  };

  const requestWithdrawalApproval = async (fundId: string, amount: number, reason: string) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const fund = funds.find(f => f.id === fundId);
      if (!fund) return;

      // Tính số người cần duyệt: mặc định cần 2 người, nhưng nếu có trưởng nhóm thì chỉ cần 1
      let neededApprovals = 2;
      
      // Nếu quỹ chỉ có 2 người thì cần chủ quỹ duyệt (chỉ cần 1)
      if (fund.members.length === 2) {
        neededApprovals = 1;
      }

      const userInfo = await getUserInfo(user.uid);

      await addDoc(collection(db, 'fundWithdrawals'), {
        fundId: fundId,
        userId: user.uid,
        userName: userInfo.name,
        amount: amount,
        reason: reason,
        type: 'normal',
        status: 'pending',
        approvedBy: [],
        neededApprovals: neededApprovals,
        createdAt: new Date(),
      });

      setWithdrawModalVisible(false);
      setWithdrawAmount('');
      setWithdrawReason('');
      setSelectedFund(null);

      Alert.alert(
        'Thành công', 
        `Đã gửi yêu cầu rút ${amount.toLocaleString()}đ!\nCần ${neededApprovals} người đồng ý để được rút tiền.`
      );
    } catch (error) {
      console.error('Lỗi gửi yêu cầu rút tiền:', error);
      Alert.alert('Lỗi', 'Không thể gửi yêu cầu rút tiền!');
    }
  };

  const approveWithdrawal = async (withdrawal: PendingWithdrawal) => {
    const user = auth.currentUser;
    if (!user || !selectedFund) return;

    try {
      const withdrawalRef = doc(db, 'fundWithdrawals', withdrawal.id);
      const fundRef = doc(db, 'groupFunds', selectedFund.id);

      const updatedApprovedBy = [...withdrawal.approvedBy, user.uid];

      // Tính toán số người cần duyệt: nếu có trưởng nhóm trong danh sách đồng ý thì chỉ cần 1
      let neededApprovals = withdrawal.neededApprovals;
      
      // Kiểm tra xem trưởng nhóm có trong danh sách đồng ý không
      const hasCreatorApproval = updatedApprovedBy.includes(selectedFund.createdBy);
      
      // Nếu trưởng nhóm đã đồng ý, chỉ cần 1 người duyệt
      if (hasCreatorApproval) {
        neededApprovals = 1;
      }

      if (updatedApprovedBy.length >= neededApprovals) {
        // Đủ số người đồng ý - thực hiện rút tiền
        const fundSnap = await getDoc(fundRef);
        if (!fundSnap.exists()) return;

        const fundData = fundSnap.data();
        const newAmount = (fundData.currentAmount || 0) - withdrawal.amount;

        await updateDoc(fundRef, {
          currentAmount: newAmount,
        });

        await updateDoc(withdrawalRef, {
          status: 'approved',
          approvedBy: updatedApprovedBy,
        });

        // Cộng tiền vào tài khoản người rút
        const userBankRef = collection(db, "users", withdrawal.userId, "bankAccount");
        const userBankSnapshot = await getDocs(userBankRef);
        if (!userBankSnapshot.empty) {
          const userBankData = userBankSnapshot.docs[0];
          const userBankDocRef = doc(db, "users", withdrawal.userId, "bankAccount", userBankData.id);
          const newUserBalance = (userBankData.data().balance || 0) + withdrawal.amount;
          await updateDoc(userBankDocRef, { balance: newUserBalance });
        }

        setFunds(prevFunds => 
          prevFunds.map(fund => 
            fund.id === selectedFund.id 
              ? { ...fund, currentAmount: newAmount }
              : fund
          )
        );

        Alert.alert('Thành công', `Đã duyệt và chuyển ${withdrawal.amount.toLocaleString()}đ cho ${withdrawal.userName}!`);
      } else {
        // Chưa đủ, chỉ cập nhật danh sách đồng ý
        await updateDoc(withdrawalRef, {
          approvedBy: updatedApprovedBy,
        });

        Alert.alert('Thành công', `Đã đồng ý yêu cầu rút tiền của ${withdrawal.userName}!`);
      }

      await loadFundData(selectedFund.id);
      await loadPendingWithdrawals(selectedFund.id);
    } catch (error) {
      console.error('Lỗi duyệt rút tiền:', error);
      Alert.alert('Lỗi', 'Không thể duyệt yêu cầu rút tiền!');
    }
  };

  const rejectWithdrawal = async (withdrawal: PendingWithdrawal) => {
    Alert.alert(
      'Từ chối yêu cầu',
      `Bạn có chắc muốn từ chối yêu cầu rút ${withdrawal.amount.toLocaleString()}đ của ${withdrawal.userName}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Từ chối',
          style: 'destructive',
          onPress: async () => {
            try {
              const withdrawalRef = doc(db, 'fundWithdrawals', withdrawal.id);
              await updateDoc(withdrawalRef, {
                status: 'rejected',
              });

              await loadPendingWithdrawals(selectedFund?.id || '');
              Alert.alert('Thành công', 'Đã từ chối yêu cầu rút tiền!');
            } catch (error) {
              console.error('Lỗi từ chối rút tiền:', error);
              Alert.alert('Lỗi', 'Không thể từ chối yêu cầu rút tiền!');
            }
          },
        },
      ]
    );
  };

  const openWithdrawModal = (fund: Fund) => {
    setSelectedFund(fund);
    setWithdrawAmount('');
    setWithdrawReason('');
    setWithdrawType('normal');
    setWithdrawModalVisible(true);
  };

  const leaveFund = async (fundId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    Alert.alert(
      'Xác nhận',
      'Bạn có chắc muốn rời khỏi quỹ này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Rời khỏi',
          style: 'destructive',
          onPress: async () => {
            try {
              const fundRef = doc(db, 'groupFunds', fundId);
              
              await updateDoc(fundRef, {
                members: arrayRemove(user.uid),
              });

              Alert.alert('Thành công', 'Đã rời khỏi quỹ!');
            } catch (error) {
              console.error('Lỗi rời khỏi quỹ:', error);
              Alert.alert('Lỗi', 'Không thể rời khỏi quỹ!');
            }
          },
        },
      ]
    );
  };

  const deleteFund = async (fundId: string) => {
    Alert.alert(
      'Xác nhận',
      'Bạn có chắc muốn xóa quỹ này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'groupFunds', fundId));
              Alert.alert('Thành công', 'Đã xóa quỹ!');
            } catch (error) {
              console.error('Lỗi xóa quỹ:', error);
              Alert.alert('Lỗi', 'Không thể xóa quỹ!');
            }
          },
        },
      ]
    );
  };

  const getProgress = (fund: Fund) => {
    return fund.targetAmount > 0 ? (fund.currentAmount / fund.targetAmount) * 100 : 0;
  };

  const getUserDisplayName = (userId: string): string => {
    if (allUsers[userId]) {
      return allUsers[userId].name || allUsers[userId].email.split('@')[0] || 'User';
    }
    
    const friend = friends.find(f => f.id === userId);
    if (friend) {
      return friend.name || friend.email.split('@')[0] || 'User';
    }
    
    if (userId === auth.currentUser?.uid) {
      return auth.currentUser?.email?.split('@')[0] || 'You';
    }
    
    return 'User';
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const calculateProgressPercentage = (fund: Fund, contributions: MemberContribution[]) => {
    if (!contributions || contributions.length === 0) return [];
    
    const totalNetAmount = contributions.reduce((sum, member) => sum + member.netAmount, 0);
    
    if (totalNetAmount === 0) return [];
    
    return contributions.map(member => ({
      ...member,
      percentage: (member.netAmount / totalNetAmount) * 100
    }));
  };

  const getAvailableFriends = (fund: Fund) => {
    return friends.filter(friend => !fund.members.includes(friend.id));
  };

  const isFundCreator = (fund: Fund) => {
    return fund.createdBy === auth.currentUser?.uid;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>👥 Quỹ Chi Tiêu Nhóm</Text>
        <Text style={styles.subtitle}>Cùng nhau góp quỹ thực hiện dự án</Text>
        
        <View style={styles.bankBalanceHeader}>
          <Text style={styles.bankBalanceLabel}>Số dư tài khoản của bạn:</Text>
          <Text style={styles.bankBalanceAmount}>
            {bankAccount ? bankAccount.balance.toLocaleString("vi-VN") : "0"} VND
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>💰 Tạo quỹ mới</Text>
        
        <Text style={styles.label}>Tên quỹ</Text>
        <TextInput
          style={styles.input}
          placeholder="VD: Du lịch Đà Nẵng, Mua TV..."
          value={fundName}
          onChangeText={setFundName}
        />

        <Text style={styles.label}>Số tiền mục tiêu (VND)</Text>
        <TextInput
          style={styles.input}
          placeholder="VD: 5000000"
          keyboardType="numeric"
          value={targetAmount}
          onChangeText={setTargetAmount}
        />

        <Text style={styles.label}>Mô tả</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Mô tả về mục đích của quỹ..."
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.label}>Mời bạn bè tham gia và phân bổ phần trăm</Text>
        
        <View style={styles.percentageSection}>
          <Text style={styles.percentageLabel}>Bản thân:</Text>
          <View style={styles.percentageInputContainer}>
            <TextInput
              style={styles.percentageInput}
              placeholder="0"
              keyboardType="numeric"
              value={memberPercentages[auth.currentUser?.uid || '']?.toString() || ''}
              onChangeText={(text) => updateMemberPercentage(auth.currentUser?.uid || '', Number(text) || 0)}
            />
            <Text style={styles.percentageSymbol}>%</Text>
          </View>
        </View>

        {friends.length > 0 ? (
          <View style={styles.friendsList}>
            {friends.map(friend => (
              <View key={friend.id} style={styles.friendWithPercentage}>
                <TouchableOpacity
                  style={[
                    styles.friendItem,
                    selectedFriends.includes(friend.id) ? styles.selectedFriend : undefined
                  ]}
                  onPress={() => toggleFriendSelection(friend.id)}
                >
                  <Text style={[
                    styles.friendText,
                    selectedFriends.includes(friend.id) ? styles.selectedFriendText : undefined
                  ]}>
                    👤 {friend.name || friend.email.split('@')[0] || 'User'}
                  </Text>
                </TouchableOpacity>
                
                {selectedFriends.includes(friend.id) && (
                  <View style={styles.percentageInputContainer}>
                    <TextInput
                      style={styles.percentageInput}
                      placeholder="0"
                      keyboardType="numeric"
                      value={memberPercentages[friend.id]?.toString() || ''}
                      onChangeText={(text) => updateMemberPercentage(friend.id, Number(text) || 0)}
                    />
                    <Text style={styles.percentageSymbol}>%</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noFriendsText}>
            Chưa có bạn bè. Hãy kết bạn trước!
          </Text>
        )}

        <View style={styles.totalPercentage}>
          <Text style={styles.totalPercentageText}>
            Tổng phần trăm: {getTotalPercentage({
              [auth.currentUser?.uid || '']: memberPercentages[auth.currentUser?.uid || ''] || 0,
              ...memberPercentages
            })}%
          </Text>
          {getTotalPercentage({
            [auth.currentUser?.uid || '']: memberPercentages[auth.currentUser?.uid || ''] || 0,
            ...memberPercentages
          }) !== 100 && (
            <Text style={styles.percentageWarning}>⚠️ Tổng phần trăm phải bằng 100%</Text>
          )}
        </View>

        <TouchableOpacity 
          style={[
            styles.createButton,
            getTotalPercentage({
              [auth.currentUser?.uid || '']: memberPercentages[auth.currentUser?.uid || ''] || 0,
              ...memberPercentages
            }) !== 100 ? styles.disabledButton : undefined
          ]} 
          onPress={createFund}
          disabled={getTotalPercentage({
            [auth.currentUser?.uid || '']: memberPercentages[auth.currentUser?.uid || ''] || 0,
            ...memberPercentages
          }) !== 100}
        >
          <Text style={styles.createButtonText}>➕ Tạo quỹ mới</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Quỹ của bạn</Text>
      {funds.length > 0 ? (
        funds.map(fund => (
          <View key={fund.id} style={styles.fundCard}>
<View style={styles.fundHeader}>
  <View style={styles.fundTitleRow}>
    <Text style={styles.fundName} numberOfLines={2}>
      🎯 {fund.name}
    </Text>
    <View style={styles.fundActions}>
      {pendingWithdrawals[fund.id] && pendingWithdrawals[fund.id].length > 0 && (
        <TouchableOpacity 
          style={styles.approvalButton}
          onPress={() => openApprovalModal(fund)}
        >
          <Text style={styles.approvalButtonText}>✅ {pendingWithdrawals[fund.id].length}</Text>
        </TouchableOpacity>
      )}
      {isFundCreator(fund) && (
        <TouchableOpacity 
          style={styles.editPercentageButton}
          onPress={() => openEditPercentageModal(fund)}
        >
          <Text style={styles.editPercentageButtonText}>✏️ %</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity 
        style={styles.addMemberButton}
        onPress={() => openAddMemberModal(fund)}
      >
        <Text style={styles.addMemberButtonText}>👥 Thêm</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.withdrawButton}
        onPress={() => openWithdrawModal(fund)}
      >
        <Text style={styles.withdrawButtonText}>💸 Rút</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.leaveButton}
        onPress={() => leaveFund(fund.id)}
      >
        <Text style={styles.leaveButtonText}>🚪 Rời</Text>
      </TouchableOpacity>
      {isFundCreator(fund) && (
        <TouchableOpacity onPress={() => deleteFund(fund.id)}>
          <Text style={styles.deleteText}>🗑️</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
</View>
            
            <Text style={styles.fundDescription}>{fund.description}</Text>
            
            <Text style={styles.fundInfo}>
              Số dư: <Text style={styles.amount}>{fund.currentAmount.toLocaleString()}</Text> /{' '}
              <Text style={styles.amount}>{fund.targetAmount.toLocaleString()}</Text> VND
            </Text>

            <View style={styles.fundNote}>
              <Text style={styles.fundNoteText}>
                {isFundCreator(fund) 
                  ? '👑 Bạn là chủ quỹ - Có thể rút toàn bộ số dư'
                  : '💡 Thành viên - Rút khẩn cấp tối đa 20%, rút lớn cần được duyệt'
                }
              </Text>
            </View>

            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>Tiến độ hoàn thành mục tiêu:</Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(getProgress(fund), 100)}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {getProgress(fund).toFixed(1)}% ({fund.currentAmount.toLocaleString()}đ / {fund.targetAmount.toLocaleString()}đ)
              </Text>
            </View>

            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>Phân bổ đóng góp thực tế:</Text>
              <View style={styles.progressBar}>
                {(() => {
                  const calculatedContributions = calculateProgressPercentage(
                    fund, 
                    memberContributions[fund.id] || []
                  );
                  
                  return calculatedContributions.map((member, index) => (
                    <View
                      key={member.userId}
                      style={[
                        styles.progressSegment,
                        { 
                          width: `${member.percentage}%`,
                          backgroundColor: member.color
                        }
                      ]}
                    />
                  ));
                })()}
                
                {(!memberContributions[fund.id] || memberContributions[fund.id].length === 0) && (
                  <View style={[styles.progressSegment, { width: '100%', backgroundColor: '#ffe6ee' }]} />
                )}
              </View>
              
              <View style={styles.legend}>
                {(() => {
                  const calculatedContributions = calculateProgressPercentage(
                    fund, 
                    memberContributions[fund.id] || []
                  );
                  
                  return calculatedContributions.map((member, index) => (
                    <View key={member.userId} style={styles.legendItem}>
                      <View 
                        style={[
                          styles.legendColor, 
                          { backgroundColor: member.color }
                        ]} 
                      />
                      <Text style={styles.legendText}>
                        {member.userName}: {member.netAmount.toLocaleString()}đ
                        {member.percentage > 0 && ` (${member.percentage.toFixed(1)}%)`}
                      </Text>
                    </View>
                  ));
                })()}
                
                {(!memberContributions[fund.id] || memberContributions[fund.id].length === 0) && (
                  <Text style={styles.noContributionsText}>Chưa có đóng góp nào</Text>
                )}
              </View>
            </View>

            {withdrawals[fund.id] && withdrawals[fund.id].length > 0 && (
              <View style={styles.withdrawalsSection}>
                <Text style={styles.label}>Lịch sử rút quỹ:</Text>
                {withdrawals[fund.id].slice(0, 3).map((withdrawal, index) => (
                  <View key={index} style={styles.withdrawalItem}>
                    <Text style={styles.withdrawalText}>
                      {withdrawal.type === 'emergency' ? '🚨' : '💸'} {withdrawal.userName} rút {withdrawal.amount.toLocaleString()}đ
                      {withdrawal.status === 'pending' && ' ⏳'}
                    </Text>
                    {withdrawal.reason && (
                      <Text style={styles.withdrawalReason}>Lý do: {withdrawal.reason}</Text>
                    )}
                    {withdrawal.createdAt && (
                      <Text style={styles.withdrawalDate}>
                        {withdrawal.createdAt.toDate?.()?.toLocaleDateString('vi-VN') || 'Hôm nay'}
                      </Text>
                    )}
                  </View>
                ))}
                {withdrawals[fund.id].length > 3 && (
                  <Text style={styles.moreWithdrawalsText}>
                    ...và {withdrawals[fund.id].length - 3} giao dịch khác
                  </Text>
                )}
              </View>
            )}

            <Text style={styles.label}>Thành viên ({fund.members.length}):</Text>
            <View style={styles.membersList}>
              {fund.members.map((memberId, index) => (
                <View key={memberId} style={styles.memberItem}>
                  <View 
                    style={[
                      styles.memberColor,
                      { 
                        backgroundColor: memberContributions[fund.id]?.find(m => m.userId === memberId)?.color || 
                                       getMemberColor(index) 
                      }
                    ]} 
                  />
                  <Text style={styles.memberText}>
                    {getUserDisplayName(memberId)}
                    {memberId === fund.createdBy && ' 👑'}
                    {memberId === auth.currentUser?.uid && ' (You)'}
                    {fund.memberPercentages && fund.memberPercentages[memberId] && 
                      ` - ${fund.memberPercentages[memberId]}%`
                    }
                  </Text>
                  {isFundCreator(fund) && memberId !== fund.createdBy && (
                    <TouchableOpacity 
                      style={styles.kickButton}
                      onPress={() => kickMember(fund.id, memberId)}
                    >
                      <Text style={styles.kickButtonText}>❌</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            <Text style={styles.label}>Đóng góp nhanh:</Text>
            <View style={styles.quickActions}>
              {[50000, 100000, 200000, 500000].map(amount => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.quickButton,
                    (loadingFunds[fund.id] || (bankAccount && bankAccount.balance < amount)) ? styles.disabledButton : undefined
                  ]}
                  onPress={() => contributeToFund(fund.id, amount)}
                  disabled={loadingFunds[fund.id] || (bankAccount ? bankAccount.balance < amount : true)}
                >
                  <Text style={styles.quickButtonText}>
                    {loadingFunds[fund.id] ? '⏳' : '+'}{amount / 1000}k
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ContributionInput 
              onContribute={(amount) => contributeToFund(fund.id, amount)}
              isLoading={loadingFunds[fund.id]}
              bankBalance={bankAccount?.balance || 0}
            />
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💸</Text>
          <Text style={styles.emptyText}>Chưa có quỹ nào</Text>
          <Text style={styles.emptySubText}>Tạo quỹ đầu tiên để bắt đầu!</Text>
        </View>
      )}

      {/* Modal rút quỹ */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={withdrawModalVisible}
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>💸 Rút quỹ</Text>
            
            {selectedFund && (
              <>
                <Text style={styles.modalFundName}>Quỹ: {selectedFund.name}</Text>
                <Text style={styles.modalBalance}>
                  Số dư hiện tại: <Text style={styles.amount}>{selectedFund.currentAmount.toLocaleString()}đ</Text>
                </Text>

                {!isFundCreator(selectedFund) && (
                  <View style={styles.withdrawTypeContainer}>
                    <Text style={styles.label}>Loại rút tiền:</Text>
                    <View style={styles.withdrawTypeButtons}>
                      <TouchableOpacity
                        style={[
                          styles.withdrawTypeButton,
                          withdrawType === 'normal' ? styles.selectedWithdrawType : undefined
                        ]}
                        onPress={() => setWithdrawType('normal')}
                      >
                        <Text style={[
                          styles.withdrawTypeButtonText,
                          withdrawType === 'normal' ? styles.selectedWithdrawTypeText : undefined
                        ]}>
                          📋 Rút thường
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.withdrawTypeButton,
                          withdrawType === 'emergency' ? styles.selectedWithdrawType : undefined
                        ]}
                        onPress={() => setWithdrawType('emergency')}
                      >
                        <Text style={[
                          styles.withdrawTypeButtonText,
                          withdrawType === 'emergency' ? styles.selectedWithdrawTypeText : undefined
                        ]}>
                          🚨 Rút khẩn cấp
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.withdrawTypeNote}>
                      {withdrawType === 'emergency' 
                        ? `Rút khẩn cấp tối đa ${(selectedFund.currentAmount * 0.2).toLocaleString()}đ (20% số dư)`
                        : 'Rút thường cần được các thành viên khác đồng ý'
                      }
                    </Text>
                  </View>
                )}

                <Text style={styles.label}>Số tiền muốn rút (VND)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập số tiền..."
                  keyboardType="numeric"
                  value={withdrawAmount}
                  onChangeText={setWithdrawAmount}
                />

                <Text style={styles.label}>Lý do rút quỹ</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="VD: Mua vé máy bay, Thanh toán khách sạn..."
                  value={withdrawReason}
                  onChangeText={setWithdrawReason}
                  multiline
                />

                <View style={styles.modalNote}>
                  <Text style={styles.modalNoteText}>
                    {isFundCreator(selectedFund)
                      ? '💰 Chủ quỹ - Tiền sẽ được chuyển ngay vào tài khoản của bạn'
                      : withdrawType === 'emergency'
                      ? '🚨 Rút khẩn cấp - Tiền sẽ được chuyển ngay vào tài khoản của bạn'
                      : '📋 Rút thường - Cần được các thành viên khác đồng ý trước khi nhận tiền'
                    }
                  </Text>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setWithdrawModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.withdrawConfirmButton]}
                    onPress={withdrawFromFund}
                  >
                    <Text style={styles.withdrawConfirmButtonText}>
                      {isFundCreator(selectedFund) || withdrawType === 'emergency' 
                        ? 'Xác nhận rút' 
                        : 'Gửi yêu cầu'
                      }
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal duyệt rút tiền */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={approvalModalVisible}
        onRequestClose={() => setApprovalModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>✅ Duyệt rút tiền</Text>
            
            {selectedFund && (
              <>
                <Text style={styles.modalFundName}>Quỹ: {selectedFund.name}</Text>
                
                {pendingWithdrawals[selectedFund.id] && pendingWithdrawals[selectedFund.id].length > 0 ? (
                  <ScrollView style={styles.pendingWithdrawalsList}>
                    {pendingWithdrawals[selectedFund.id].map((withdrawal, index) => (
                      <View key={withdrawal.id} style={styles.pendingWithdrawalItem}>
                        <View style={styles.pendingWithdrawalHeader}>
                          <Text style={styles.pendingWithdrawalUser}>
                            👤 {withdrawal.userName}
                          </Text>
                          <Text style={styles.pendingWithdrawalAmount}>
                            {withdrawal.amount.toLocaleString()}đ
                          </Text>
                        </View>
                        
                        <Text style={styles.pendingWithdrawalReason}>
                          Lý do: {withdrawal.reason}
                        </Text>
                        
                        <Text style={styles.pendingWithdrawalApprovals}>
                          Đã đồng ý: {withdrawal.approvedBy.length}/{withdrawal.neededApprovals}
                          {withdrawal.approvedBy.includes(selectedFund.createdBy) && ' (Có trưởng nhóm)'}
                        </Text>
                        
                        <Text style={styles.pendingWithdrawalDate}>
                          Ngày gửi: {withdrawal.createdAt?.toDate?.()?.toLocaleDateString('vi-VN') || 'Hôm nay'}
                        </Text>

                        {!withdrawal.approvedBy.includes(auth.currentUser?.uid || '') ? (
                          <View style={styles.approvalButtons}>
                            <TouchableOpacity 
                              style={[styles.approvalButton, styles.rejectButton]}
                              onPress={() => rejectWithdrawal(withdrawal)}
                            >
                              <Text style={styles.rejectButtonText}>Từ chối</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.approvalButton, styles.approveButton]}
                              onPress={() => approveWithdrawal(withdrawal)}
                            >
                              <Text style={styles.approveButtonText}>Đồng ý</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <Text style={styles.alreadyApprovedText}>
                            ✅ Bạn đã đồng ý yêu cầu này
                          </Text>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.noPendingText}>Không có yêu cầu rút tiền nào đang chờ</Text>
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setApprovalModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Đóng</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal sửa phần trăm - ĐÃ THÊM SCROLLVIEW */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editPercentageModalVisible}
        onRequestClose={() => setEditPercentageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>✏️ Sửa phân bổ phần trăm</Text>
            
            {fundToEditPercentages && (
              <>
                <Text style={styles.modalFundName}>Quỹ: {fundToEditPercentages.name}</Text>
                <Text style={styles.label}>Điều chỉnh phần trăm cho từng thành viên:</Text>

                {/* THÊM SCROLLVIEW Ở ĐÂY */}
                <ScrollView style={styles.percentageEditList}>
                  {fundToEditPercentages.members.map(memberId => (
                    <View key={memberId} style={styles.percentageEditItem}>
                      <Text style={styles.percentageEditName}>
                        {getUserDisplayName(memberId)}
                        {memberId === fundToEditPercentages.createdBy && ' 👑'}
                      </Text>
                      <View style={styles.percentageInputContainer}>
                        <TextInput
                          style={styles.percentageInput}
                          placeholder="0"
                          keyboardType="numeric"
                          value={editingPercentages[memberId]?.toString() || '0'}
                          onChangeText={(text) => updateEditingPercentage(memberId, Number(text) || 0)}
                        />
                        <Text style={styles.percentageSymbol}>%</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.totalPercentage}>
                  <Text style={styles.totalPercentageText}>
                    Tổng phần trăm: {getTotalPercentage(editingPercentages)}%
                  </Text>
                  {getTotalPercentage(editingPercentages) !== 100 && (
                    <Text style={styles.percentageWarning}>⚠️ Tổng phần trăm phải bằng 100%</Text>
                  )}
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setEditPercentageModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.modalButton, 
                      styles.savePercentageButton,
                      getTotalPercentage(editingPercentages) !== 100 ? styles.disabledButton : undefined
                    ]}
                    onPress={saveEditedPercentages}
                    disabled={getTotalPercentage(editingPercentages) !== 100}
                  >
                    <Text style={styles.savePercentageButtonText}>Lưu thay đổi</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal thêm thành viên */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addMemberModalVisible}
        onRequestClose={() => setAddMemberModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>👥 Thêm thành viên</Text>
            
            {fundToAddMembers && (
              <>
                <Text style={styles.modalFundName}>Quỹ: {fundToAddMembers.name}</Text>
                <Text style={styles.label}>Chọn bạn bè và phân bổ phần trăm:</Text>

                {getAvailableFriends(fundToAddMembers).length > 0 ? (
                  <View style={styles.availableFriendsList}>
                    {getAvailableFriends(fundToAddMembers).map(friend => (
                      <View key={friend.id} style={styles.friendWithPercentage}>
                        <View style={styles.friendItem}>
                          <Text style={styles.friendText}>
                            👤 {friend.name || friend.email.split('@')[0] || 'User'}
                          </Text>
                        </View>
                        
                        <View style={styles.percentageInputContainer}>
                          <TextInput
                            style={styles.percentageInput}
                            placeholder="0"
                            keyboardType="numeric"
                            value={newMemberPercentages[friend.id]?.toString() || ''}
                            onChangeText={(text) => updateNewMemberPercentage(friend.id, Number(text) || 0)}
                          />
                          <Text style={styles.percentageSymbol}>%</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noFriendsText}>Không có bạn bè nào để thêm</Text>
                )}

                <View style={styles.totalPercentage}>
                  <Text style={styles.totalPercentageText}>
                    Tổng phần trăm mới: {getTotalPercentage(newMemberPercentages)}%
                  </Text>
                  <Text style={styles.totalPercentageText}>
                    Tổng phần trăm hiện tại: {getTotalPercentage(fundToAddMembers.memberPercentages || {})}%
                  </Text>
                  <Text style={styles.totalPercentageText}>
                    Tổng sau khi thêm: {getTotalPercentage(fundToAddMembers.memberPercentages || {}) + getTotalPercentage(newMemberPercentages)}%
                  </Text>
                  {getTotalPercentage(fundToAddMembers.memberPercentages || {}) + getTotalPercentage(newMemberPercentages) !== 100 && (
                    <Text style={styles.percentageWarning}>⚠️ Tổng phần trăm phải bằng 100%</Text>
                  )}
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setAddMemberModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.modalButton, 
                      styles.addMemberConfirmButton,
                      (getTotalPercentage(fundToAddMembers.memberPercentages || {}) + getTotalPercentage(newMemberPercentages) !== 100) ? styles.disabledButton : undefined
                    ]}
                    onPress={addMembersToFund}
                    disabled={getTotalPercentage(fundToAddMembers.memberPercentages || {}) + getTotalPercentage(newMemberPercentages) !== 100}
                  >
                    <Text style={styles.addMemberConfirmButtonText}>Thêm thành viên</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const ContributionInput: React.FC<{ 
  onContribute: (amount: number) => void;
  isLoading?: boolean;
  bankBalance: number;
}> = ({ onContribute, isLoading = false, bankBalance }) => {
  const [customAmount, setCustomAmount] = useState('');

  const handleContribute = () => {
    const amount = Number(customAmount);
    if (amount > 0) {
      if (amount > bankBalance) {
        Alert.alert('Lỗi', `Không đủ tiền trong tài khoản! Số dư hiện tại: ${bankBalance.toLocaleString()}đ`);
        return;
      }
      onContribute(amount);
      setCustomAmount('');
    } else {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ!');
    }
  };

  return (
    <View style={styles.contributionContainer}>
      <TextInput
        style={[styles.input, { flex: 1, marginRight: 10 }]}
        placeholder="Nhập số tiền..."
        keyboardType="numeric"
        value={customAmount}
        onChangeText={setCustomAmount}
        editable={!isLoading}
      />
      <TouchableOpacity 
        style={[
          styles.contributeButton,
          isLoading ? styles.disabledButton : undefined
        ]} 
        onPress={handleContribute}
        disabled={isLoading}
      >
        <Text style={styles.contributeButtonText}>
          {isLoading ? '⏳' : '💵'} Đóng góp
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffafc',
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
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#d63384',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#ff9ec6',
    fontWeight: '500',
  },
  bankBalanceHeader: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#fff0f5',
  },
  bankBalanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
  },
  bankBalanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0077b6',
  },
  card: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#fff0f5',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d63384',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d63384',
    marginBottom: 8,
    marginTop: 12,
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
    height: 80,
    textAlignVertical: 'top',
  },
  friendsList: {
    marginBottom: 12,
  },
  friendWithPercentage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  friendItem: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 12,
    flex: 1,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedFriend: {
    backgroundColor: '#ffe6ee',
    borderColor: '#ff6b9d',
  },
  friendText: {
    color: '#666',
    fontSize: 12,
  },
  selectedFriendText: {
    color: '#d63384',
    fontWeight: '600',
  },
  percentageSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
  },
  percentageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0077b6',
  },
  percentageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentageInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    width: 60,
    textAlign: 'center',
    backgroundColor: 'white',
  },
  percentageSymbol: {
    marginLeft: 4,
    fontWeight: 'bold',
    color: '#666',
  },
  totalPercentage: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  totalPercentageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  percentageWarning: {
    fontSize: 12,
    color: '#ff6b6b',
    fontWeight: '600',
    marginTop: 4,
  },
  noFriendsText: {
    color: '#ff9ec6',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  createButton: {
    backgroundColor: '#ff6b9d',
    padding: 18,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  createButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d63384',
    margin: 16,
    marginBottom: 8,
  },
  fundCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginVertical: 8,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#fff0f5',
  },
  fundHeader: {
  marginBottom: 8,
},
fundTitleRow: {
  flexDirection: 'column',
},
fundName: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#d63384',
  marginBottom: 8, // Thêm khoảng cách dưới tên
  flexWrap: 'wrap',
},
fundActions: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-start', // Căn trái các nút
  flexWrap: 'wrap', // Cho phép xuống dòng nếu cần
},
  approvalButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  approvalButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 10,
  },
  editPercentageButton: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  editPercentageButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  addMemberButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  addMemberButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  withdrawButton: {
    backgroundColor: '#FFA726',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  withdrawButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  leaveButton: {
    backgroundColor: '#EF5350',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  leaveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  deleteText: {
    fontSize: 18,
    color: '#ff6b6b',
  },
  fundDescription: {
    color: '#666',
    marginBottom: 12,
    fontSize: 14,
  },
  fundInfo: {
    fontSize: 16,
    marginBottom: 12,
    color: '#333',
  },
  fundNote: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e6f3ff',
  },
  fundNoteText: {
    fontSize: 12,
    color: '#0077b6',
    textAlign: 'center',
    fontWeight: '500',
  },
  amount: {
    color: '#0077b6',
    fontWeight: 'bold',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  progressBar: {
    backgroundColor: '#ffe6ee',
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4facfe',
    borderRadius: 10,
  },
  progressSegment: {
    height: '100%',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  noContributionsText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  withdrawalsSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  withdrawalItem: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  withdrawalText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  withdrawalReason: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  withdrawalDate: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  moreWithdrawalsText: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 8,
    margin: 4,
    flex: 1,
    minWidth: '45%',
  },
  memberColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  memberText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  kickButton: {
    marginLeft: 8,
    padding: 4,
  },
  kickButtonText: {
    fontSize: 12,
    color: '#ff6b6b',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  quickButton: {
    backgroundColor: '#4facfe',
    padding: 10,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  quickButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  contributionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contributeButton: {
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contributeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#d63384',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#ff9ec6',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d63384',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalFundName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalBalance: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  withdrawTypeContainer: {
    marginBottom: 16,
  },
  withdrawTypeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  withdrawTypeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  selectedWithdrawType: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0f8ff',
  },
  withdrawTypeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  selectedWithdrawTypeText: {
    color: '#4CAF50',
  },
  withdrawTypeNote: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalNote: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e6f3ff',
  },
  modalNoteText: {
    fontSize: 12,
    color: '#0077b6',
    textAlign: 'center',
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#dee2e6',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  withdrawConfirmButton: {
    backgroundColor: '#FFA726',
  },
  withdrawConfirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  savePercentageButton: {
    backgroundColor: '#9C27B0',
  },
  savePercentageButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  addMemberConfirmButton: {
    backgroundColor: '#4CAF50',
  },
  addMemberConfirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  availableFriendsList: {
    maxHeight: 200,
  },
  pendingWithdrawalsList: {
    maxHeight: 400,
  },
  pendingWithdrawalItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  pendingWithdrawalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pendingWithdrawalUser: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  pendingWithdrawalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0077b6',
  },
  pendingWithdrawalReason: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  pendingWithdrawalApprovals: {
    fontSize: 11,
    color: '#FFA726',
    fontWeight: '600',
    marginBottom: 4,
  },
  pendingWithdrawalDate: {
    fontSize: 10,
    color: '#999',
    marginBottom: 8,
  },
  approvalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ModalApprovalButton: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  approveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  rejectButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  rejectButtonText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 12,
  },
  alreadyApprovedText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    textAlign: 'center',
    padding: 8,
  },
  noPendingText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    padding: 20,
  },
  percentageEditList: {
    maxHeight: 300,
  },
  percentageEditItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  percentageEditName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
});

export default GroupFunds;
=======
import { useRouter } from 'expo-router';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { auth, db } from '../firebase';

interface Fund {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  createdBy: string;
  members: string[];
  description: string;
  createdAt: any;
  memberPercentages?: {[userId: string]: number};
  pendingWithdrawals?: PendingWithdrawal[];
}

interface User {
  id: string;
  email: string;
  name?: string;
}

interface FundContribution {
  userId: string;
  amount: number;
  userName?: string;
  userEmail?: string;
}

interface FundWithdrawal {
  userId: string;
  amount: number;
  userName?: string;
  reason?: string;
  createdAt?: any;
  type?: 'normal' | 'emergency' | 'approved';
  status?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string[];
}

interface PendingWithdrawal {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  reason: string;
  createdAt: any;
  approvedBy: string[];
  neededApprovals: number;
}

interface MemberContribution {
  userId: string;
  userName: string;
  userEmail: string;
  netAmount: number;
  color: string;
  percentage: number;
}

interface BankAccount {
  id: string;
  balance: number;
}

const GroupFunds: React.FC = () => {
  const router = useRouter();
  const [funds, setFunds] = useState<Fund[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [fundName, setFundName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [memberPercentages, setMemberPercentages] = useState<{[userId: string]: number}>({});
  const [memberContributions, setMemberContributions] = useState<{[fundId: string]: MemberContribution[]}>({});
  const [withdrawals, setWithdrawals] = useState<{[fundId: string]: FundWithdrawal[]}>({});
  const [allUsers, setAllUsers] = useState<{[userId: string]: User}>({});
  const [loadingFunds, setLoadingFunds] = useState<{[fundId: string]: boolean}>({});
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [selectedFund, setSelectedFund] = useState<Fund | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawType, setWithdrawType] = useState<'emergency' | 'normal'>('normal');

  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [fundToAddMembers, setFundToAddMembers] = useState<Fund | null>(null);
  const [newMemberPercentages, setNewMemberPercentages] = useState<{[userId: string]: number}>({});

  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<{[fundId: string]: PendingWithdrawal[]}>({});

  const [editPercentageModalVisible, setEditPercentageModalVisible] = useState(false);
  const [fundToEditPercentages, setFundToEditPercentages] = useState<Fund | null>(null);
  const [editingPercentages, setEditingPercentages] = useState<{[userId: string]: number}>({});

  const loadBankAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const bankRef = collection(db, "users", user.uid, "bankAccount");
      const bankSnapshot = await getDocs(bankRef);
      
      if (bankSnapshot.empty) {
        const newBankAccount = {
          balance: 0,
          createdAt: new Date(),
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
      console.error('Lỗi tải số dư tài khoản:', error);
    }
  };

  const updateBankBalance = async (newBalance: number) => {
    const user = auth.currentUser;
    if (!user || !bankAccount) return;

    try {
      const bankRef = doc(db, "users", user.uid, "bankAccount", bankAccount.id);
      await updateDoc(bankRef, { balance: newBalance });
      setBankAccount({ ...bankAccount, balance: newBalance });
    } catch (error) {
      console.error('Lỗi khi cập nhật số dư:', error);
      Alert.alert("Lỗi", "Không thể cập nhật số dư!");
    }
  };

  const loadFriends = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const friendIds = userData.friends || [];
        
        const friendsList: User[] = [];
        const usersMap: {[userId: string]: User} = {};
        
        for (const friendId of friendIds) {
          const friendRef = doc(db, 'users', friendId);
          const friendSnap = await getDoc(friendRef);
          if (friendSnap.exists()) {
            const friendData = friendSnap.data();
            const userInfo: User = { 
              id: friendId, 
              email: friendData.email || '',
              name: friendData.name || friendData.email?.split('@')[0] || 'User'
            };
            friendsList.push(userInfo);
            usersMap[friendId] = userInfo;
          }
        }
        
        const currentUserInfo: User = {
          id: user.uid,
          email: user.email || '',
          name: user.displayName || user.email?.split('@')[0] || 'You'
        };
        usersMap[user.uid] = currentUserInfo;
        
        setFriends(friendsList);
        setAllUsers(prev => ({ ...prev, ...usersMap }));
      }
    } catch (error) {
      console.error('Lỗi tải danh sách bạn:', error);
    }
  };

  const loadFunds = () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const fundsRef = collection(db, 'groupFunds');
      const q = query(fundsRef, where('members', 'array-contains', user.uid));
      
      return onSnapshot(q, async (snapshot) => {
        const fundsData = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || '',
          targetAmount: doc.data().targetAmount || 0,
          currentAmount: doc.data().currentAmount || 0,
          createdBy: doc.data().createdBy || '',
          members: doc.data().members || [],
          description: doc.data().description || '',
          createdAt: doc.data().createdAt,
          memberPercentages: doc.data().memberPercentages || {},
          pendingWithdrawals: doc.data().pendingWithdrawals || [],
        })) as Fund[];
        
        setFunds(fundsData);

        for (const fund of fundsData) {
          await loadFundData(fund.id);
          await loadPendingWithdrawals(fund.id);
        }
      });
    } catch (error) {
      console.error('Lỗi tải quỹ:', error);
      return undefined;
    }
  };

  const getUserInfo = async (userId: string): Promise<User> => {
    try {
      if (allUsers[userId]) {
        return allUsers[userId];
      }

      const friend = friends.find(f => f.id === userId);
      if (friend) {
        return friend;
      }

      if (userId === auth.currentUser?.uid) {
        const currentUser = auth.currentUser;
        return {
          id: userId,
          email: currentUser.email || '',
          name: currentUser.displayName || currentUser.email?.split('@')[0] || 'You'
        };
      }

      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const userInfo: User = {
          id: userId,
          email: userData.email || '',
          name: userData.name || userData.email?.split('@')[0] || 'User'
        };
        
        setAllUsers(prev => ({ ...prev, [userId]: userInfo }));
        return userInfo;
      }

      const defaultUser: User = {
        id: userId,
        email: 'Unknown',
        name: 'User'
      };
      return defaultUser;
    } catch (error) {
      console.error('Lỗi lấy thông tin user:', error);
      return {
        id: userId,
        email: 'Unknown',
        name: 'User'
      };
    }
  };

  const getMemberColor = (index: number) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#FFA726', '#AB47BC', '#26A69A', '#42A5F5', '#7E57C2'
    ];
    return colors[index % colors.length];
  };

  const loadFundData = async (fundId: string) => {
    try {
      const contributionsRef = collection(db, 'fundContributions');
      const contributionsQuery = query(contributionsRef, where('fundId', '==', fundId));
      const contributionsSnapshot = await getDocs(contributionsQuery);
      
      const contributions = contributionsSnapshot.docs.map(doc => doc.data() as FundContribution);

      const withdrawalsRef = collection(db, 'fundWithdrawals');
      const withdrawalsQuery = query(withdrawalsRef, where('fundId', '==' , fundId));
      const withdrawalsSnapshot = await getDocs(withdrawalsQuery);
      
      const withdrawalsData = await Promise.all(
        withdrawalsSnapshot.docs.map(async (doc) => {
          const data = doc.data();
          const userInfo = await getUserInfo(data.userId);
          return {
            userId: data.userId,
            amount: data.amount,
            userName: userInfo.name,
            reason: data.reason,
            createdAt: data.createdAt,
            type: data.type || 'normal',
            status: data.status,
            approvedBy: data.approvedBy || [],
          } as FundWithdrawal;
        })
      );

      setWithdrawals(prev => ({
        ...prev,
        [fundId]: withdrawalsData
      }));

      const userNetContributions: {[userId: string]: number} = {};
      
      contributions.forEach(contribution => {
        userNetContributions[contribution.userId] = 
          (userNetContributions[contribution.userId] || 0) + contribution.amount;
      });

      withdrawalsData.forEach(withdrawal => {
        if (withdrawal.status !== 'rejected') {
          userNetContributions[withdrawal.userId] = 
            (userNetContributions[withdrawal.userId] || 0) - withdrawal.amount;
        }
      });

      const memberContributionsArray: MemberContribution[] = [];
      const userIds = Object.keys(userNetContributions);
      
      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        const userInfo = await getUserInfo(userId);
        const netAmount = userNetContributions[userId];
        
        if (netAmount > 0) {
          memberContributionsArray.push({
            userId,
            userName: userInfo.name || userInfo.email.split('@')[0] || 'User',
            userEmail: userInfo.email,
            netAmount,
            color: getMemberColor(i),
            percentage: 0
          });
        }
      }

      memberContributionsArray.sort((a, b) => b.netAmount - a.netAmount);

      const totalNetAmount = memberContributionsArray.reduce((sum, member) => sum + member.netAmount, 0);
      if (totalNetAmount > 0) {
        memberContributionsArray.forEach(member => {
          member.percentage = (member.netAmount / totalNetAmount) * 100;
        });
      }

      setMemberContributions(prev => ({
        ...prev,
        [fundId]: memberContributionsArray
      }));
    } catch (error) {
      console.error('Lỗi tính toán dữ liệu quỹ:', error);
    }
  };

  const loadPendingWithdrawals = async (fundId: string) => {
    try {
      const withdrawalsRef = collection(db, 'fundWithdrawals');
      const withdrawalsQuery = query(
        withdrawalsRef, 
        where('fundId', '==', fundId),
        where('status', '==', 'pending')
      );
      const withdrawalsSnapshot = await getDocs(withdrawalsQuery);
      
      const pendingWithdrawalsData = await Promise.all(
        withdrawalsSnapshot.docs.map(async (doc) => {
          const data = doc.data();
          const userInfo = await getUserInfo(data.userId);
          return {
            id: doc.id,
            userId: data.userId,
            userName: userInfo.name,
            amount: data.amount,
            reason: data.reason,
            createdAt: data.createdAt,
            approvedBy: data.approvedBy || [],
            neededApprovals: data.neededApprovals || 1,
          } as PendingWithdrawal;
        })
      );

      setPendingWithdrawals(prev => ({
        ...prev,
        [fundId]: pendingWithdrawalsData
      }));
    } catch (error) {
      console.error('Lỗi tải yêu cầu rút tiền:', error);
    }
  };

  useEffect(() => {
    loadFriends();
    loadBankAccount();
    const unsubscribe = loadFunds();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const updateMemberPercentage = (userId: string, percentage: number) => {
    setMemberPercentages(prev => ({
      ...prev,
      [userId]: percentage
    }));
  };

  const updateNewMemberPercentage = (userId: string, percentage: number) => {
    setNewMemberPercentages(prev => ({
      ...prev,
      [userId]: percentage
    }));
  };

  const updateEditingPercentage = (userId: string, percentage: number) => {
    setEditingPercentages(prev => ({
      ...prev,
      [userId]: percentage
    }));
  };

  const getTotalPercentage = (percentages: {[userId: string]: number}) => {
    return Object.values(percentages).reduce((sum, percentage) => sum + percentage, 0);
  };

  const createFund = async () => {
    const user = auth.currentUser;
    if (!user || !fundName || !targetAmount) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên quỹ và số tiền mục tiêu!');
      return;
    }

    const allPercentages = {
      [user.uid]: memberPercentages[user.uid] || 0,
      ...memberPercentages
    };

    const totalPercentage = getTotalPercentage(allPercentages);
    
    if (totalPercentage !== 100) {
      Alert.alert('Lỗi', `Tổng phần trăm phải bằng 100%! Hiện tại: ${totalPercentage}%`);
      return;
    }

    try {
      const members = [user.uid, ...selectedFriends];
      
      await addDoc(collection(db, 'groupFunds'), {
        name: fundName,
        targetAmount: Number(targetAmount),
        currentAmount: 0,
        createdBy: user.uid,
        members: members,
        description: description,
        memberPercentages: allPercentages,
        createdAt: new Date(),
        pendingWithdrawals: [],
      });

      Alert.alert('Thành công', 'Đã tạo quỹ mới!');
      setFundName('');
      setTargetAmount('');
      setDescription('');
      setSelectedFriends([]);
      setMemberPercentages({});
    } catch (error) {
      console.error('Lỗi tạo quỹ:', error);
      Alert.alert('Lỗi', 'Không thể tạo quỹ!');
    }
  };

  const addMembersToFund = async () => {
    if (!fundToAddMembers) return;

    const totalCurrentPercentage = getTotalPercentage(fundToAddMembers.memberPercentages || {});
    const totalNewPercentage = getTotalPercentage(newMemberPercentages);
    const combinedTotal = totalCurrentPercentage + totalNewPercentage;

    if (combinedTotal !== 100) {
      Alert.alert('Lỗi', `Tổng phần trăm phải bằng 100%! Hiện tại: ${combinedTotal}%`);
      return;
    }

    try {
      const fundRef = doc(db, 'groupFunds', fundToAddMembers.id);
      
      const updatedMemberPercentages = {
        ...fundToAddMembers.memberPercentages,
        ...newMemberPercentages
      };

      await updateDoc(fundRef, {
        members: arrayUnion(...Object.keys(newMemberPercentages)),
        memberPercentages: updatedMemberPercentages
      });

      Alert.alert('Thành công', 'Đã thêm thành viên vào quỹ!');
      setAddMemberModalVisible(false);
      setNewMemberPercentages({});
      setFundToAddMembers(null);
    } catch (error) {
      console.error('Lỗi thêm thành viên:', error);
      Alert.alert('Lỗi', 'Không thể thêm thành viên!');
    }
  };

  const kickMember = async (fundId: string, memberId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const fund = funds.find(f => f.id === fundId);
    if (!fund) return;

    if (fund.createdBy !== user.uid) {
      Alert.alert('Lỗi', 'Chỉ chủ quỹ mới có thể xóa thành viên!');
      return;
    }

    if (memberId === user.uid) {
      Alert.alert('Lỗi', 'Bạn không thể xóa chính mình khỏi quỹ!');
      return;
    }

    Alert.alert(
      'Xác nhận xóa thành viên',
      `Bạn có chắc muốn xóa ${getUserDisplayName(memberId)} khỏi quỹ?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              const fundRef = doc(db, 'groupFunds', fundId);
              
              await updateDoc(fundRef, {
                members: arrayRemove(memberId),
              });

              Alert.alert('Thành công', `Đã xóa ${getUserDisplayName(memberId)} khỏi quỹ!`);
            } catch (error) {
              console.error('Lỗi xóa thành viên:', error);
              Alert.alert('Lỗi', 'Không thể xóa thành viên!');
            }
          },
        },
      ]
    );
  };

  const openEditPercentageModal = (fund: Fund) => {
    setFundToEditPercentages(fund);
    
    const initialPercentages: {[userId: string]: number} = {};
    fund.members.forEach(memberId => {
      initialPercentages[memberId] = fund.memberPercentages?.[memberId] || 0;
    });
    
    setEditingPercentages(initialPercentages);
    setEditPercentageModalVisible(true);
  };

  const saveEditedPercentages = async () => {
    if (!fundToEditPercentages) return;

    const completePercentages: {[userId: string]: number} = {};
    fundToEditPercentages.members.forEach(memberId => {
      completePercentages[memberId] = editingPercentages[memberId] || 0;
    });

    const totalPercentage = getTotalPercentage(completePercentages);
    
    if (totalPercentage !== 100) {
      Alert.alert('Lỗi', `Tổng phần trăm phải bằng 100%! Hiện tại: ${totalPercentage}%`);
      return;
    }

    try {
      const fundRef = doc(db, 'groupFunds', fundToEditPercentages.id);
      
      await updateDoc(fundRef, {
        memberPercentages: completePercentages
      });

      Alert.alert('Thành công', 'Đã cập nhật phân bổ phần trăm!');
      setEditPercentageModalVisible(false);
      setFundToEditPercentages(null);
      setEditingPercentages({});
    } catch (error) {
      console.error('Lỗi cập nhật phần trăm:', error);
      Alert.alert('Lỗi', 'Không thể cập nhật phần trăm!');
    }
  };

  const openAddMemberModal = (fund: Fund) => {
    setFundToAddMembers(fund);
    setNewMemberPercentages({});
    setAddMemberModalVisible(true);
  };

  const openApprovalModal = (fund: Fund) => {
    setSelectedFund(fund);
    setApprovalModalVisible(true);
  };

  const contributeToFund = async (fundId: string, amount: number) => {
    const user = auth.currentUser;
    if (!user) return;

    if (!bankAccount || bankAccount.balance < amount) {
      Alert.alert('Lỗi', `Không đủ tiền trong tài khoản! Số dư hiện tại: ${bankAccount?.balance.toLocaleString() || 0}đ`);
      return;
    }

    setLoadingFunds(prev => ({ ...prev, [fundId]: true }));

    try {
      const fundRef = doc(db, 'groupFunds', fundId);
      
      const fundSnap = await getDoc(fundRef);
      if (!fundSnap.exists()) {
        Alert.alert('Lỗi', 'Quỹ không tồn tại!');
        return;
      }

      const fundData = fundSnap.data();
      const newAmount = (fundData.currentAmount || 0) + amount;
      
      await updateDoc(fundRef, {
        currentAmount: newAmount,
      });

      await addDoc(collection(db, 'fundContributions'), {
        fundId,
        userId: user.uid,
        amount,
        createdAt: new Date(),
      });

      const newBankBalance = bankAccount.balance - amount;
      await updateBankBalance(newBankBalance);

      setFunds(prevFunds => 
        prevFunds.map(fund => 
          fund.id === fundId 
            ? { ...fund, currentAmount: newAmount }
            : fund
        )
      );

      await loadFundData(fundId);

      Alert.alert('Thành công', `Đã đóng góp ${amount.toLocaleString()}đ vào quỹ từ tài khoản của bạn!`);
    } catch (error) {
      console.error('Lỗi đóng góp:', error);
      Alert.alert('Lỗi', 'Không thể đóng góp!');
    } finally {
      setLoadingFunds(prev => ({ ...prev, [fundId]: false }));
    }
  };

  const withdrawFromFund = async () => {
    const user = auth.currentUser;
    if (!user || !selectedFund) return;

    const amount = Number(withdrawAmount);
    
    if (!amount || amount <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ!');
      return;
    }

    if (!withdrawReason.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập lý do rút quỹ!');
      return;
    }

    if (amount > selectedFund.currentAmount) {
      Alert.alert('Lỗi', `Số tiền rút không được vượt quá ${selectedFund.currentAmount.toLocaleString()}đ trong quỹ!`);
      return;
    }

    const isCreator = selectedFund.createdBy === user.uid;
    
    if (isCreator) {
      await processWithdrawal(selectedFund.id, amount, withdrawReason, 'normal');
    } else {
      if (withdrawType === 'emergency') {
        const maxEmergencyAmount = selectedFund.currentAmount * 0.2;
        if (amount > maxEmergencyAmount) {
          Alert.alert('Lỗi', `Rút khẩn cấp chỉ được tối đa ${maxEmergencyAmount.toLocaleString()}đ (20% số dư quỹ)!`);
          return;
        }
        await processWithdrawal(selectedFund.id, amount, withdrawReason, 'emergency');
      } else {
        await requestWithdrawalApproval(selectedFund.id, amount, withdrawReason);
      }
    }
  };

  const processWithdrawal = async (fundId: string, amount: number, reason: string, type: 'normal' | 'emergency') => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const fundRef = doc(db, 'groupFunds', fundId);
      
      const fundSnap = await getDoc(fundRef);
      if (!fundSnap.exists()) {
        Alert.alert('Lỗi', 'Quỹ không tồn tại!');
        return;
      }

      const fundData = fundSnap.data();
      const newAmount = (fundData.currentAmount || 0) - amount;
      
      await updateDoc(fundRef, {
        currentAmount: newAmount,
      });

      const userInfo = await getUserInfo(user.uid);
      await addDoc(collection(db, 'fundWithdrawals'), {
        fundId: fundId,
        userId: user.uid,
        userName: userInfo.name,
        amount: amount,
        reason: reason,
        type: type,
        status: 'approved',
        createdAt: new Date(),
      });

      const newBankBalance = (bankAccount?.balance || 0) + amount;
      await updateBankBalance(newBankBalance);

      setFunds(prevFunds => 
        prevFunds.map(fund => 
          fund.id === fundId 
            ? { ...fund, currentAmount: newAmount }
            : fund
        )
      );

      await loadFundData(fundId);

      setWithdrawModalVisible(false);
      setWithdrawAmount('');
      setWithdrawReason('');
      setSelectedFund(null);

      Alert.alert('Thành công', `Đã rút ${amount.toLocaleString()}đ từ quỹ! Tiền đã được chuyển vào tài khoản của bạn.`);
    } catch (error) {
      console.error('Lỗi rút quỹ:', error);
      Alert.alert('Lỗi', 'Không thể rút quỹ!');
    }
  };

  const requestWithdrawalApproval = async (fundId: string, amount: number, reason: string) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const fund = funds.find(f => f.id === fundId);
      if (!fund) return;

      // Tính số người cần duyệt: mặc định cần 2 người, nhưng nếu có trưởng nhóm thì chỉ cần 1
      let neededApprovals = 2;
      
      // Nếu quỹ chỉ có 2 người thì cần chủ quỹ duyệt (chỉ cần 1)
      if (fund.members.length === 2) {
        neededApprovals = 1;
      }

      const userInfo = await getUserInfo(user.uid);

      await addDoc(collection(db, 'fundWithdrawals'), {
        fundId: fundId,
        userId: user.uid,
        userName: userInfo.name,
        amount: amount,
        reason: reason,
        type: 'normal',
        status: 'pending',
        approvedBy: [],
        neededApprovals: neededApprovals,
        createdAt: new Date(),
      });

      setWithdrawModalVisible(false);
      setWithdrawAmount('');
      setWithdrawReason('');
      setSelectedFund(null);

      Alert.alert(
        'Thành công', 
        `Đã gửi yêu cầu rút ${amount.toLocaleString()}đ!\nCần ${neededApprovals} người đồng ý để được rút tiền.`
      );
    } catch (error) {
      console.error('Lỗi gửi yêu cầu rút tiền:', error);
      Alert.alert('Lỗi', 'Không thể gửi yêu cầu rút tiền!');
    }
  };

  const approveWithdrawal = async (withdrawal: PendingWithdrawal) => {
    const user = auth.currentUser;
    if (!user || !selectedFund) return;

    try {
      const withdrawalRef = doc(db, 'fundWithdrawals', withdrawal.id);
      const fundRef = doc(db, 'groupFunds', selectedFund.id);

      const updatedApprovedBy = [...withdrawal.approvedBy, user.uid];

      // Tính toán số người cần duyệt: nếu có trưởng nhóm trong danh sách đồng ý thì chỉ cần 1
      let neededApprovals = withdrawal.neededApprovals;
      
      // Kiểm tra xem trưởng nhóm có trong danh sách đồng ý không
      const hasCreatorApproval = updatedApprovedBy.includes(selectedFund.createdBy);
      
      // Nếu trưởng nhóm đã đồng ý, chỉ cần 1 người duyệt
      if (hasCreatorApproval) {
        neededApprovals = 1;
      }

      if (updatedApprovedBy.length >= neededApprovals) {
        // Đủ số người đồng ý - thực hiện rút tiền
        const fundSnap = await getDoc(fundRef);
        if (!fundSnap.exists()) return;

        const fundData = fundSnap.data();
        const newAmount = (fundData.currentAmount || 0) - withdrawal.amount;

        await updateDoc(fundRef, {
          currentAmount: newAmount,
        });

        await updateDoc(withdrawalRef, {
          status: 'approved',
          approvedBy: updatedApprovedBy,
        });

        // Cộng tiền vào tài khoản người rút
        const userBankRef = collection(db, "users", withdrawal.userId, "bankAccount");
        const userBankSnapshot = await getDocs(userBankRef);
        if (!userBankSnapshot.empty) {
          const userBankData = userBankSnapshot.docs[0];
          const userBankDocRef = doc(db, "users", withdrawal.userId, "bankAccount", userBankData.id);
          const newUserBalance = (userBankData.data().balance || 0) + withdrawal.amount;
          await updateDoc(userBankDocRef, { balance: newUserBalance });
        }

        setFunds(prevFunds => 
          prevFunds.map(fund => 
            fund.id === selectedFund.id 
              ? { ...fund, currentAmount: newAmount }
              : fund
          )
        );

        Alert.alert('Thành công', `Đã duyệt và chuyển ${withdrawal.amount.toLocaleString()}đ cho ${withdrawal.userName}!`);
      } else {
        // Chưa đủ, chỉ cập nhật danh sách đồng ý
        await updateDoc(withdrawalRef, {
          approvedBy: updatedApprovedBy,
        });

        Alert.alert('Thành công', `Đã đồng ý yêu cầu rút tiền của ${withdrawal.userName}!`);
      }

      await loadFundData(selectedFund.id);
      await loadPendingWithdrawals(selectedFund.id);
    } catch (error) {
      console.error('Lỗi duyệt rút tiền:', error);
      Alert.alert('Lỗi', 'Không thể duyệt yêu cầu rút tiền!');
    }
  };

  const rejectWithdrawal = async (withdrawal: PendingWithdrawal) => {
    Alert.alert(
      'Từ chối yêu cầu',
      `Bạn có chắc muốn từ chối yêu cầu rút ${withdrawal.amount.toLocaleString()}đ của ${withdrawal.userName}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Từ chối',
          style: 'destructive',
          onPress: async () => {
            try {
              const withdrawalRef = doc(db, 'fundWithdrawals', withdrawal.id);
              await updateDoc(withdrawalRef, {
                status: 'rejected',
              });

              await loadPendingWithdrawals(selectedFund?.id || '');
              Alert.alert('Thành công', 'Đã từ chối yêu cầu rút tiền!');
            } catch (error) {
              console.error('Lỗi từ chối rút tiền:', error);
              Alert.alert('Lỗi', 'Không thể từ chối yêu cầu rút tiền!');
            }
          },
        },
      ]
    );
  };

  const openWithdrawModal = (fund: Fund) => {
    setSelectedFund(fund);
    setWithdrawAmount('');
    setWithdrawReason('');
    setWithdrawType('normal');
    setWithdrawModalVisible(true);
  };

  const leaveFund = async (fundId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    Alert.alert(
      'Xác nhận',
      'Bạn có chắc muốn rời khỏi quỹ này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Rời khỏi',
          style: 'destructive',
          onPress: async () => {
            try {
              const fundRef = doc(db, 'groupFunds', fundId);
              
              await updateDoc(fundRef, {
                members: arrayRemove(user.uid),
              });

              Alert.alert('Thành công', 'Đã rời khỏi quỹ!');
            } catch (error) {
              console.error('Lỗi rời khỏi quỹ:', error);
              Alert.alert('Lỗi', 'Không thể rời khỏi quỹ!');
            }
          },
        },
      ]
    );
  };

  const deleteFund = async (fundId: string) => {
    Alert.alert(
      'Xác nhận',
      'Bạn có chắc muốn xóa quỹ này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'groupFunds', fundId));
              Alert.alert('Thành công', 'Đã xóa quỹ!');
            } catch (error) {
              console.error('Lỗi xóa quỹ:', error);
              Alert.alert('Lỗi', 'Không thể xóa quỹ!');
            }
          },
        },
      ]
    );
  };

  const getProgress = (fund: Fund) => {
    return fund.targetAmount > 0 ? (fund.currentAmount / fund.targetAmount) * 100 : 0;
  };

  const getUserDisplayName = (userId: string): string => {
    if (allUsers[userId]) {
      return allUsers[userId].name || allUsers[userId].email.split('@')[0] || 'User';
    }
    
    const friend = friends.find(f => f.id === userId);
    if (friend) {
      return friend.name || friend.email.split('@')[0] || 'User';
    }
    
    if (userId === auth.currentUser?.uid) {
      return auth.currentUser?.email?.split('@')[0] || 'You';
    }
    
    return 'User';
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const calculateProgressPercentage = (fund: Fund, contributions: MemberContribution[]) => {
    if (!contributions || contributions.length === 0) return [];
    
    const totalNetAmount = contributions.reduce((sum, member) => sum + member.netAmount, 0);
    
    if (totalNetAmount === 0) return [];
    
    return contributions.map(member => ({
      ...member,
      percentage: (member.netAmount / totalNetAmount) * 100
    }));
  };

  const getAvailableFriends = (fund: Fund) => {
    return friends.filter(friend => !fund.members.includes(friend.id));
  };

  const isFundCreator = (fund: Fund) => {
    return fund.createdBy === auth.currentUser?.uid;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>👥 Group Funds</Text>
        <Text style={styles.subtitle}>Pool money with friends for shared goals</Text>
        
        <View style={styles.bankBalanceHeader}>
          <Text style={styles.bankBalanceLabel}>Số dư tài khoản của bạn:</Text>
          <Text style={styles.bankBalanceAmount}>
            {bankAccount ? bankAccount.balance.toLocaleString("vi-VN") : "0"} VND
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>💰 Tạo quỹ mới</Text>
        
        <Text style={styles.label}>Tên quỹ</Text>
        <TextInput
          style={styles.input}
          placeholder="VD: Du lịch Đà Nẵng, Mua TV..."
          value={fundName}
          onChangeText={setFundName}
        />

        <Text style={styles.label}>Số tiền mục tiêu (VND)</Text>
        <TextInput
          style={styles.input}
          placeholder="VD: 5000000"
          keyboardType="numeric"
          value={targetAmount}
          onChangeText={setTargetAmount}
        />

        <Text style={styles.label}>Mô tả</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Mô tả về mục đích của quỹ..."
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.label}>Mời bạn bè tham gia và phân bổ phần trăm</Text>
        
        <View style={styles.percentageSection}>
          <Text style={styles.percentageLabel}>Bản thân:</Text>
          <View style={styles.percentageInputContainer}>
            <TextInput
              style={styles.percentageInput}
              placeholder="0"
              keyboardType="numeric"
              value={memberPercentages[auth.currentUser?.uid || '']?.toString() || ''}
              onChangeText={(text) => updateMemberPercentage(auth.currentUser?.uid || '', Number(text) || 0)}
            />
            <Text style={styles.percentageSymbol}>%</Text>
          </View>
        </View>

        {friends.length > 0 ? (
          <View style={styles.friendsList}>
            {friends.map(friend => (
              <View key={friend.id} style={styles.friendWithPercentage}>
                <TouchableOpacity
                  style={[
                    styles.friendItem,
                    selectedFriends.includes(friend.id) ? styles.selectedFriend : undefined
                  ]}
                  onPress={() => toggleFriendSelection(friend.id)}
                >
                  <Text style={[
                    styles.friendText,
                    selectedFriends.includes(friend.id) ? styles.selectedFriendText : undefined
                  ]}>
                    👤 {friend.name || friend.email.split('@')[0] || 'User'}
                  </Text>
                </TouchableOpacity>
                
                {selectedFriends.includes(friend.id) && (
                  <View style={styles.percentageInputContainer}>
                    <TextInput
                      style={styles.percentageInput}
                      placeholder="0"
                      keyboardType="numeric"
                      value={memberPercentages[friend.id]?.toString() || ''}
                      onChangeText={(text) => updateMemberPercentage(friend.id, Number(text) || 0)}
                    />
                    <Text style={styles.percentageSymbol}>%</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noFriendsText}>
            Chưa có bạn bè. Hãy kết bạn trước!
          </Text>
        )}

        <View style={styles.totalPercentage}>
          <Text style={styles.totalPercentageText}>
            Tổng phần trăm: {getTotalPercentage({
              [auth.currentUser?.uid || '']: memberPercentages[auth.currentUser?.uid || ''] || 0,
              ...memberPercentages
            })}%
          </Text>
          {getTotalPercentage({
            [auth.currentUser?.uid || '']: memberPercentages[auth.currentUser?.uid || ''] || 0,
            ...memberPercentages
          }) !== 100 && (
            <Text style={styles.percentageWarning}>⚠️ Tổng phần trăm phải bằng 100%</Text>
          )}
        </View>

        <TouchableOpacity 
          style={[
            styles.createButton,
            getTotalPercentage({
              [auth.currentUser?.uid || '']: memberPercentages[auth.currentUser?.uid || ''] || 0,
              ...memberPercentages
            }) !== 100 ? styles.disabledButton : undefined
          ]} 
          onPress={createFund}
          disabled={getTotalPercentage({
            [auth.currentUser?.uid || '']: memberPercentages[auth.currentUser?.uid || ''] || 0,
            ...memberPercentages
          }) !== 100}
        >
          <Text style={styles.createButtonText}>➕ Tạo quỹ mới</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Quỹ của bạn</Text>
      {funds.length > 0 ? (
        funds.map(fund => (
          <View key={fund.id} style={styles.fundCard}>
<View style={styles.fundHeader}>
  <View style={styles.fundTitleRow}>
    <Text style={styles.fundName} numberOfLines={2}>
      🎯 {fund.name}
    </Text>
    <View style={styles.fundActions}>
      {pendingWithdrawals[fund.id] && pendingWithdrawals[fund.id].length > 0 && (
        <TouchableOpacity 
          style={styles.approvalButton}
          onPress={() => openApprovalModal(fund)}
        >
          <Text style={styles.approvalButtonText}>✅ {pendingWithdrawals[fund.id].length}</Text>
        </TouchableOpacity>
      )}
      {isFundCreator(fund) && (
        <TouchableOpacity 
          style={styles.editPercentageButton}
          onPress={() => openEditPercentageModal(fund)}
        >
          <Text style={styles.editPercentageButtonText}>✏️ %</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity 
        style={styles.addMemberButton}
        onPress={() => openAddMemberModal(fund)}
      >
        <Text style={styles.addMemberButtonText}>👥 Thêm</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.withdrawButton}
        onPress={() => openWithdrawModal(fund)}
      >
        <Text style={styles.withdrawButtonText}>💸 Rút</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.leaveButton}
        onPress={() => leaveFund(fund.id)}
      >
        <Text style={styles.leaveButtonText}>🚪 Rời</Text>
      </TouchableOpacity>
      {isFundCreator(fund) && (
        <TouchableOpacity onPress={() => deleteFund(fund.id)}>
          <Text style={styles.deleteText}>🗑️</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
</View>
            
            <Text style={styles.fundDescription}>{fund.description}</Text>
            
            <Text style={styles.fundInfo}>
              Số dư: <Text style={styles.amount}>{fund.currentAmount.toLocaleString()}</Text> /{' '}
              <Text style={styles.amount}>{fund.targetAmount.toLocaleString()}</Text> VND
            </Text>

            <View style={styles.fundNote}>
              <Text style={styles.fundNoteText}>
                {isFundCreator(fund) 
                  ? '👑 Bạn là chủ quỹ - Có thể rút toàn bộ số dư'
                  : '💡 Thành viên - Rút khẩn cấp tối đa 20%, rút lớn cần được duyệt'
                }
              </Text>
            </View>

            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>Tiến độ hoàn thành mục tiêu:</Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(getProgress(fund), 100)}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {getProgress(fund).toFixed(1)}% ({fund.currentAmount.toLocaleString()}đ / {fund.targetAmount.toLocaleString()}đ)
              </Text>
            </View>

            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>Phân bổ đóng góp thực tế:</Text>
              <View style={styles.progressBar}>
                {(() => {
                  const calculatedContributions = calculateProgressPercentage(
                    fund, 
                    memberContributions[fund.id] || []
                  );
                  
                  return calculatedContributions.map((member, index) => (
                    <View
                      key={member.userId}
                      style={[
                        styles.progressSegment,
                        { 
                          width: `${member.percentage}%`,
                          backgroundColor: member.color
                        }
                      ]}
                    />
                  ));
                })()}
                
                {(!memberContributions[fund.id] || memberContributions[fund.id].length === 0) && (
                  <View style={[styles.progressSegment, { width: '100%', backgroundColor: '#ffe6ee' }]} />
                )}
              </View>
              
              <View style={styles.legend}>
                {(() => {
                  const calculatedContributions = calculateProgressPercentage(
                    fund, 
                    memberContributions[fund.id] || []
                  );
                  
                  return calculatedContributions.map((member, index) => (
                    <View key={member.userId} style={styles.legendItem}>
                      <View 
                        style={[
                          styles.legendColor, 
                          { backgroundColor: member.color }
                        ]} 
                      />
                      <Text style={styles.legendText}>
                        {member.userName}: {member.netAmount.toLocaleString()}đ
                        {member.percentage > 0 && ` (${member.percentage.toFixed(1)}%)`}
                      </Text>
                    </View>
                  ));
                })()}
                
                {(!memberContributions[fund.id] || memberContributions[fund.id].length === 0) && (
                  <Text style={styles.noContributionsText}>Chưa có đóng góp nào</Text>
                )}
              </View>
            </View>

            {withdrawals[fund.id] && withdrawals[fund.id].length > 0 && (
              <View style={styles.withdrawalsSection}>
                <Text style={styles.label}>Lịch sử rút quỹ:</Text>
                {withdrawals[fund.id].slice(0, 3).map((withdrawal, index) => (
                  <View key={index} style={styles.withdrawalItem}>
                    <Text style={styles.withdrawalText}>
                      {withdrawal.type === 'emergency' ? '🚨' : '💸'} {withdrawal.userName} rút {withdrawal.amount.toLocaleString()}đ
                      {withdrawal.status === 'pending' && ' ⏳'}
                    </Text>
                    {withdrawal.reason && (
                      <Text style={styles.withdrawalReason}>Lý do: {withdrawal.reason}</Text>
                    )}
                    {withdrawal.createdAt && (
                      <Text style={styles.withdrawalDate}>
                        {withdrawal.createdAt.toDate?.()?.toLocaleDateString('vi-VN') || 'Hôm nay'}
                      </Text>
                    )}
                  </View>
                ))}
                {withdrawals[fund.id].length > 3 && (
                  <Text style={styles.moreWithdrawalsText}>
                    ...và {withdrawals[fund.id].length - 3} giao dịch khác
                  </Text>
                )}
              </View>
            )}

            <Text style={styles.label}>Thành viên ({fund.members.length}):</Text>
            <View style={styles.membersList}>
              {fund.members.map((memberId, index) => (
                <View key={memberId} style={styles.memberItem}>
                  <View 
                    style={[
                      styles.memberColor,
                      { 
                        backgroundColor: memberContributions[fund.id]?.find(m => m.userId === memberId)?.color || 
                                       getMemberColor(index) 
                      }
                    ]} 
                  />
                  <Text style={styles.memberText}>
                    {getUserDisplayName(memberId)}
                    {memberId === fund.createdBy && ' 👑'}
                    {memberId === auth.currentUser?.uid && ' (You)'}
                    {fund.memberPercentages && fund.memberPercentages[memberId] && 
                      ` - ${fund.memberPercentages[memberId]}%`
                    }
                  </Text>
                  {isFundCreator(fund) && memberId !== fund.createdBy && (
                    <TouchableOpacity 
                      style={styles.kickButton}
                      onPress={() => kickMember(fund.id, memberId)}
                    >
                      <Text style={styles.kickButtonText}>❌</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            <Text style={styles.label}>Đóng góp nhanh:</Text>
            <View style={styles.quickActions}>
              {[50000, 100000, 200000, 500000].map(amount => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.quickButton,
                    (loadingFunds[fund.id] || (bankAccount && bankAccount.balance < amount)) ? styles.disabledButton : undefined
                  ]}
                  onPress={() => contributeToFund(fund.id, amount)}
                  disabled={loadingFunds[fund.id] || (bankAccount ? bankAccount.balance < amount : true)}
                >
                  <Text style={styles.quickButtonText}>
                    {loadingFunds[fund.id] ? '⏳' : '+'}{amount / 1000}k
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ContributionInput 
              onContribute={(amount) => contributeToFund(fund.id, amount)}
              isLoading={loadingFunds[fund.id]}
              bankBalance={bankAccount?.balance || 0}
            />
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💸</Text>
          <Text style={styles.emptyText}>Chưa có quỹ nào</Text>
          <Text style={styles.emptySubText}>Tạo quỹ đầu tiên để bắt đầu!</Text>
        </View>
      )}

      {/* Modal rút quỹ */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={withdrawModalVisible}
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>💸 Rút quỹ</Text>
            
            {selectedFund && (
              <>
                <Text style={styles.modalFundName}>Quỹ: {selectedFund.name}</Text>
                <Text style={styles.modalBalance}>
                  Số dư hiện tại: <Text style={styles.amount}>{selectedFund.currentAmount.toLocaleString()}đ</Text>
                </Text>

                {!isFundCreator(selectedFund) && (
                  <View style={styles.withdrawTypeContainer}>
                    <Text style={styles.label}>Loại rút tiền:</Text>
                    <View style={styles.withdrawTypeButtons}>
                      <TouchableOpacity
                        style={[
                          styles.withdrawTypeButton,
                          withdrawType === 'normal' ? styles.selectedWithdrawType : undefined
                        ]}
                        onPress={() => setWithdrawType('normal')}
                      >
                        <Text style={[
                          styles.withdrawTypeButtonText,
                          withdrawType === 'normal' ? styles.selectedWithdrawTypeText : undefined
                        ]}>
                          📋 Rút thường
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.withdrawTypeButton,
                          withdrawType === 'emergency' ? styles.selectedWithdrawType : undefined
                        ]}
                        onPress={() => setWithdrawType('emergency')}
                      >
                        <Text style={[
                          styles.withdrawTypeButtonText,
                          withdrawType === 'emergency' ? styles.selectedWithdrawTypeText : undefined
                        ]}>
                          🚨 Rút khẩn cấp
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.withdrawTypeNote}>
                      {withdrawType === 'emergency' 
                        ? `Rút khẩn cấp tối đa ${(selectedFund.currentAmount * 0.2).toLocaleString()}đ (20% số dư)`
                        : 'Rút thường cần được các thành viên khác đồng ý'
                      }
                    </Text>
                  </View>
                )}

                <Text style={styles.label}>Số tiền muốn rút (VND)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập số tiền..."
                  keyboardType="numeric"
                  value={withdrawAmount}
                  onChangeText={setWithdrawAmount}
                />

                <Text style={styles.label}>Lý do rút quỹ</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="VD: Mua vé máy bay, Thanh toán khách sạn..."
                  value={withdrawReason}
                  onChangeText={setWithdrawReason}
                  multiline
                />

                <View style={styles.modalNote}>
                  <Text style={styles.modalNoteText}>
                    {isFundCreator(selectedFund)
                      ? '💰 Chủ quỹ - Tiền sẽ được chuyển ngay vào tài khoản của bạn'
                      : withdrawType === 'emergency'
                      ? '🚨 Rút khẩn cấp - Tiền sẽ được chuyển ngay vào tài khoản của bạn'
                      : '📋 Rút thường - Cần được các thành viên khác đồng ý trước khi nhận tiền'
                    }
                  </Text>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setWithdrawModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.withdrawConfirmButton]}
                    onPress={withdrawFromFund}
                  >
                    <Text style={styles.withdrawConfirmButtonText}>
                      {isFundCreator(selectedFund) || withdrawType === 'emergency' 
                        ? 'Xác nhận rút' 
                        : 'Gửi yêu cầu'
                      }
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal duyệt rút tiền */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={approvalModalVisible}
        onRequestClose={() => setApprovalModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>✅ Duyệt rút tiền</Text>
            
            {selectedFund && (
              <>
                <Text style={styles.modalFundName}>Quỹ: {selectedFund.name}</Text>
                
                {pendingWithdrawals[selectedFund.id] && pendingWithdrawals[selectedFund.id].length > 0 ? (
                  <ScrollView style={styles.pendingWithdrawalsList}>
                    {pendingWithdrawals[selectedFund.id].map((withdrawal, index) => (
                      <View key={withdrawal.id} style={styles.pendingWithdrawalItem}>
                        <View style={styles.pendingWithdrawalHeader}>
                          <Text style={styles.pendingWithdrawalUser}>
                            👤 {withdrawal.userName}
                          </Text>
                          <Text style={styles.pendingWithdrawalAmount}>
                            {withdrawal.amount.toLocaleString()}đ
                          </Text>
                        </View>
                        
                        <Text style={styles.pendingWithdrawalReason}>
                          Lý do: {withdrawal.reason}
                        </Text>
                        
                        <Text style={styles.pendingWithdrawalApprovals}>
                          Đã đồng ý: {withdrawal.approvedBy.length}/{withdrawal.neededApprovals}
                          {withdrawal.approvedBy.includes(selectedFund.createdBy) && ' (Có trưởng nhóm)'}
                        </Text>
                        
                        <Text style={styles.pendingWithdrawalDate}>
                          Ngày gửi: {withdrawal.createdAt?.toDate?.()?.toLocaleDateString('vi-VN') || 'Hôm nay'}
                        </Text>

                        {!withdrawal.approvedBy.includes(auth.currentUser?.uid || '') ? (
                          <View style={styles.approvalButtons}>
                            <TouchableOpacity 
                              style={[styles.approvalButton, styles.rejectButton]}
                              onPress={() => rejectWithdrawal(withdrawal)}
                            >
                              <Text style={styles.rejectButtonText}>Từ chối</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.approvalButton, styles.approveButton]}
                              onPress={() => approveWithdrawal(withdrawal)}
                            >
                              <Text style={styles.approveButtonText}>Đồng ý</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <Text style={styles.alreadyApprovedText}>
                            ✅ Bạn đã đồng ý yêu cầu này
                          </Text>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.noPendingText}>Không có yêu cầu rút tiền nào đang chờ</Text>
                )}

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setApprovalModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Đóng</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal sửa phần trăm - ĐÃ THÊM SCROLLVIEW */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editPercentageModalVisible}
        onRequestClose={() => setEditPercentageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>✏️ Sửa phân bổ phần trăm</Text>
            
            {fundToEditPercentages && (
              <>
                <Text style={styles.modalFundName}>Quỹ: {fundToEditPercentages.name}</Text>
                <Text style={styles.label}>Điều chỉnh phần trăm cho từng thành viên:</Text>

                {/* THÊM SCROLLVIEW Ở ĐÂY */}
                <ScrollView style={styles.percentageEditList}>
                  {fundToEditPercentages.members.map(memberId => (
                    <View key={memberId} style={styles.percentageEditItem}>
                      <Text style={styles.percentageEditName}>
                        {getUserDisplayName(memberId)}
                        {memberId === fundToEditPercentages.createdBy && ' 👑'}
                      </Text>
                      <View style={styles.percentageInputContainer}>
                        <TextInput
                          style={styles.percentageInput}
                          placeholder="0"
                          keyboardType="numeric"
                          value={editingPercentages[memberId]?.toString() || '0'}
                          onChangeText={(text) => updateEditingPercentage(memberId, Number(text) || 0)}
                        />
                        <Text style={styles.percentageSymbol}>%</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.totalPercentage}>
                  <Text style={styles.totalPercentageText}>
                    Tổng phần trăm: {getTotalPercentage(editingPercentages)}%
                  </Text>
                  {getTotalPercentage(editingPercentages) !== 100 && (
                    <Text style={styles.percentageWarning}>⚠️ Tổng phần trăm phải bằng 100%</Text>
                  )}
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setEditPercentageModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.modalButton, 
                      styles.savePercentageButton,
                      getTotalPercentage(editingPercentages) !== 100 ? styles.disabledButton : undefined
                    ]}
                    onPress={saveEditedPercentages}
                    disabled={getTotalPercentage(editingPercentages) !== 100}
                  >
                    <Text style={styles.savePercentageButtonText}>Lưu thay đổi</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal thêm thành viên */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addMemberModalVisible}
        onRequestClose={() => setAddMemberModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>👥 Thêm thành viên</Text>
            
            {fundToAddMembers && (
              <>
                <Text style={styles.modalFundName}>Quỹ: {fundToAddMembers.name}</Text>
                <Text style={styles.label}>Chọn bạn bè và phân bổ phần trăm:</Text>

                {getAvailableFriends(fundToAddMembers).length > 0 ? (
                  <View style={styles.availableFriendsList}>
                    {getAvailableFriends(fundToAddMembers).map(friend => (
                      <View key={friend.id} style={styles.friendWithPercentage}>
                        <View style={styles.friendItem}>
                          <Text style={styles.friendText}>
                            👤 {friend.name || friend.email.split('@')[0] || 'User'}
                          </Text>
                        </View>
                        
                        <View style={styles.percentageInputContainer}>
                          <TextInput
                            style={styles.percentageInput}
                            placeholder="0"
                            keyboardType="numeric"
                            value={newMemberPercentages[friend.id]?.toString() || ''}
                            onChangeText={(text) => updateNewMemberPercentage(friend.id, Number(text) || 0)}
                          />
                          <Text style={styles.percentageSymbol}>%</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noFriendsText}>Không có bạn bè nào để thêm</Text>
                )}

                <View style={styles.totalPercentage}>
                  <Text style={styles.totalPercentageText}>
                    Tổng phần trăm mới: {getTotalPercentage(newMemberPercentages)}%
                  </Text>
                  <Text style={styles.totalPercentageText}>
                    Tổng phần trăm hiện tại: {getTotalPercentage(fundToAddMembers.memberPercentages || {})}%
                  </Text>
                  <Text style={styles.totalPercentageText}>
                    Tổng sau khi thêm: {getTotalPercentage(fundToAddMembers.memberPercentages || {}) + getTotalPercentage(newMemberPercentages)}%
                  </Text>
                  {getTotalPercentage(fundToAddMembers.memberPercentages || {}) + getTotalPercentage(newMemberPercentages) !== 100 && (
                    <Text style={styles.percentageWarning}>⚠️ Tổng phần trăm phải bằng 100%</Text>
                  )}
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setAddMemberModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.modalButton, 
                      styles.addMemberConfirmButton,
                      (getTotalPercentage(fundToAddMembers.memberPercentages || {}) + getTotalPercentage(newMemberPercentages) !== 100) ? styles.disabledButton : undefined
                    ]}
                    onPress={addMembersToFund}
                    disabled={getTotalPercentage(fundToAddMembers.memberPercentages || {}) + getTotalPercentage(newMemberPercentages) !== 100}
                  >
                    <Text style={styles.addMemberConfirmButtonText}>Thêm thành viên</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const ContributionInput: React.FC<{ 
  onContribute: (amount: number) => void;
  isLoading?: boolean;
  bankBalance: number;
}> = ({ onContribute, isLoading = false, bankBalance }) => {
  const [customAmount, setCustomAmount] = useState('');

  const handleContribute = () => {
    const amount = Number(customAmount);
    if (amount > 0) {
      if (amount > bankBalance) {
        Alert.alert('Lỗi', `Không đủ tiền trong tài khoản! Số dư hiện tại: ${bankBalance.toLocaleString()}đ`);
        return;
      }
      onContribute(amount);
      setCustomAmount('');
    } else {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ!');
    }
  };

  return (
    <View style={styles.contributionContainer}>
      <TextInput
        style={[styles.input, { flex: 1, marginRight: 10 }]}
        placeholder="Nhập số tiền..."
        keyboardType="numeric"
        value={customAmount}
        onChangeText={setCustomAmount}
        editable={!isLoading}
      />
      <TouchableOpacity 
        style={[
          styles.contributeButton,
          isLoading ? styles.disabledButton : undefined
        ]} 
        onPress={handleContribute}
        disabled={isLoading}
      >
        <Text style={styles.contributeButtonText}>
          {isLoading ? '⏳' : '💵'} Đóng góp
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffafc',
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
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#d63384',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#ff9ec6',
    fontWeight: '500',
  },
  bankBalanceHeader: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#fff0f5',
  },
  bankBalanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
  },
  bankBalanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0077b6',
  },
  card: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#fff0f5',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d63384',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d63384',
    marginBottom: 8,
    marginTop: 12,
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
    height: 80,
    textAlignVertical: 'top',
  },
  friendsList: {
    marginBottom: 12,
  },
  friendWithPercentage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  friendItem: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 12,
    flex: 1,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedFriend: {
    backgroundColor: '#ffe6ee',
    borderColor: '#ff6b9d',
  },
  friendText: {
    color: '#666',
    fontSize: 12,
  },
  selectedFriendText: {
    color: '#d63384',
    fontWeight: '600',
  },
  percentageSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
  },
  percentageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0077b6',
  },
  percentageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentageInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    width: 60,
    textAlign: 'center',
    backgroundColor: 'white',
  },
  percentageSymbol: {
    marginLeft: 4,
    fontWeight: 'bold',
    color: '#666',
  },
  totalPercentage: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  totalPercentageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  percentageWarning: {
    fontSize: 12,
    color: '#ff6b6b',
    fontWeight: '600',
    marginTop: 4,
  },
  noFriendsText: {
    color: '#ff9ec6',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  createButton: {
    backgroundColor: '#ff6b9d',
    padding: 18,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#ff6b9d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  createButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d63384',
    margin: 16,
    marginBottom: 8,
  },
  fundCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginVertical: 8,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#ff9ec6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#fff0f5',
  },
  fundHeader: {
  marginBottom: 8,
},
fundTitleRow: {
  flexDirection: 'column',
},
fundName: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#d63384',
  marginBottom: 8, // Thêm khoảng cách dưới tên
  flexWrap: 'wrap',
},
fundActions: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-start', // Căn trái các nút
  flexWrap: 'wrap', // Cho phép xuống dòng nếu cần
},
  approvalButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  approvalButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 10,
  },
  editPercentageButton: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  editPercentageButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  addMemberButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  addMemberButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  withdrawButton: {
    backgroundColor: '#FFA726',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  withdrawButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  leaveButton: {
    backgroundColor: '#EF5350',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  leaveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  deleteText: {
    fontSize: 18,
    color: '#ff6b6b',
  },
  fundDescription: {
    color: '#666',
    marginBottom: 12,
    fontSize: 14,
  },
  fundInfo: {
    fontSize: 16,
    marginBottom: 12,
    color: '#333',
  },
  fundNote: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e6f3ff',
  },
  fundNoteText: {
    fontSize: 12,
    color: '#0077b6',
    textAlign: 'center',
    fontWeight: '500',
  },
  amount: {
    color: '#0077b6',
    fontWeight: 'bold',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  progressBar: {
    backgroundColor: '#ffe6ee',
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4facfe',
    borderRadius: 10,
  },
  progressSegment: {
    height: '100%',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  noContributionsText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  withdrawalsSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  withdrawalItem: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  withdrawalText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  withdrawalReason: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  withdrawalDate: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  moreWithdrawalsText: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 8,
    margin: 4,
    flex: 1,
    minWidth: '45%',
  },
  memberColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  memberText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  kickButton: {
    marginLeft: 8,
    padding: 4,
  },
  kickButtonText: {
    fontSize: 12,
    color: '#ff6b6b',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  quickButton: {
    backgroundColor: '#4facfe',
    padding: 10,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  quickButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  contributionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contributeButton: {
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contributeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#d63384',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#ff9ec6',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d63384',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalFundName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalBalance: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  withdrawTypeContainer: {
    marginBottom: 16,
  },
  withdrawTypeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  withdrawTypeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  selectedWithdrawType: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0f8ff',
  },
  withdrawTypeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  selectedWithdrawTypeText: {
    color: '#4CAF50',
  },
  withdrawTypeNote: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalNote: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e6f3ff',
  },
  modalNoteText: {
    fontSize: 12,
    color: '#0077b6',
    textAlign: 'center',
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#dee2e6',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: 'bold',
  },
  withdrawConfirmButton: {
    backgroundColor: '#FFA726',
  },
  withdrawConfirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  savePercentageButton: {
    backgroundColor: '#9C27B0',
  },
  savePercentageButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  addMemberConfirmButton: {
    backgroundColor: '#4CAF50',
  },
  addMemberConfirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  availableFriendsList: {
    maxHeight: 200,
  },
  pendingWithdrawalsList: {
    maxHeight: 400,
  },
  pendingWithdrawalItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  pendingWithdrawalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pendingWithdrawalUser: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  pendingWithdrawalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0077b6',
  },
  pendingWithdrawalReason: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  pendingWithdrawalApprovals: {
    fontSize: 11,
    color: '#FFA726',
    fontWeight: '600',
    marginBottom: 4,
  },
  pendingWithdrawalDate: {
    fontSize: 10,
    color: '#999',
    marginBottom: 8,
  },
  approvalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ModalApprovalButton: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  approveButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  rejectButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  rejectButtonText: {
    color: '#666',
    fontWeight: 'bold',
    fontSize: 12,
  },
  alreadyApprovedText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    textAlign: 'center',
    padding: 8,
  },
  noPendingText: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    padding: 20,
  },
  percentageEditList: {
    maxHeight: 300,
  },
  percentageEditItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  percentageEditName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
});

export default GroupFunds;
>>>>>>> d8bd37f (Sua cac trang blank, them nut back len moi trang, verify email khi dang ky, them chuc nang lien ket va theo doi bien dong ngan hang (chua test),...)
