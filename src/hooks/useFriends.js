import { useState, useCallback } from 'react';
import { db } from '../firebase/config';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc,
  doc,
  serverTimestamp,
  getDoc,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { 
  COLLECTIONS, 
  FRIEND_REQUEST_STATUS, 
  getUserCollectionPath,
  getDateRanges 
} from '../firebase/types';

/**
 * フレンド管理とポモドーロ取得のためのカスタムフック
 * @returns {FriendManagementFunctions & FriendPomodoroFunctions & { loading: boolean, error: string | null }}
 */
export function useFriends() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * ユーザー名でユーザーを検索
   * @type {FriendManagementFunctions['searchUserByUsername']}
   */
  const searchUserByUsername = useCallback(async (username) => {
    try {
      setLoading(true);
      setError(null);
      
      const usersRef = collection(db, COLLECTIONS.USERS);
      const q = query(usersRef, where('displayName', '==', username));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * フレンドリクエストを送信
   * @type {FriendManagementFunctions['sendFriendRequest']}
   */
  const sendFriendRequest = useCallback(async (fromUser, toUser) => {
    try {
      setLoading(true);
      setError(null);

      const requestsRef = collection(db, COLLECTIONS.FRIEND_REQUESTS);
      const q = query(
        requestsRef, 
        where('fromUserId', '==', fromUser.uid),
        where('toUserId', '==', toUser.uid)
      );
      const existingRequests = await getDocs(q);
      
      if (!existingRequests.empty) {
        throw new Error('既にフレンドリクエストを送信しています');
      }

      /** @type {FriendRequest} */
      const requestData = {
        fromUserId: fromUser.uid,
        fromUsername: fromUser.displayName,
        toUserId: toUser.uid,
        toUsername: toUser.displayName,
        status: FRIEND_REQUEST_STATUS.PENDING,
        createdAt: serverTimestamp()
      };

      await addDoc(requestsRef, requestData);
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 受信したフレンドリクエストを取得
   * @type {FriendManagementFunctions['getReceivedFriendRequests']}
   */
  const getReceivedFriendRequests = useCallback(async (userId) => {
    try {
      setLoading(true);
      setError(null);

      const requestsRef = collection(db, COLLECTIONS.FRIEND_REQUESTS);
      const q = query(
        requestsRef,
        where('toUserId', '==', userId),
        where('status', '==', FRIEND_REQUEST_STATUS.PENDING)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * フレンドリクエストに応答
   * @type {FriendManagementFunctions['respondToFriendRequest']}
   */
  const respondToFriendRequest = useCallback(async (requestId, userId, response) => {
    try {
      setLoading(true);
      setError(null);

      const requestRef = doc(db, COLLECTIONS.FRIEND_REQUESTS, requestId);
      const request = await getDoc(requestRef);
      
      if (!request.exists()) {
        throw new Error('リクエストが見つかりません');
      }

      const requestData = request.data();

      await updateDoc(requestRef, {
        status: response,
        updatedAt: serverTimestamp()
      });

      if (response === FRIEND_REQUEST_STATUS.ACCEPTED) {
        // 送信者のフレンドリストに追加
        const fromUserFriendsRef = collection(
          db, 
          getUserCollectionPath(requestData.fromUserId, COLLECTIONS.FRIENDS)
        );
        /** @type {Friend} */
        const fromUserFriend = {
          userId: requestData.toUserId,
          username: requestData.toUsername,
          createdAt: serverTimestamp()
        };
        await addDoc(fromUserFriendsRef, fromUserFriend);

        // 受信者のフレンドリストに追加
        const toUserFriendsRef = collection(
          db, 
          getUserCollectionPath(requestData.toUserId, COLLECTIONS.FRIENDS)
        );
        /** @type {Friend} */
        const toUserFriend = {
          userId: requestData.fromUserId,
          username: requestData.fromUsername,
          createdAt: serverTimestamp()
        };
        await addDoc(toUserFriendsRef, toUserFriend);
      }
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * フレンドリストを取得
   * @type {FriendManagementFunctions['getFriends']}
   */
  const getFriends = useCallback(async (userId) => {
    try {
      setLoading(true);
      setError(null);

      const friendsRef = collection(db, getUserCollectionPath(userId, COLLECTIONS.FRIENDS));
      const querySnapshot = await getDocs(friendsRef);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * フレンドの今日のポモドーロを取得
   * @type {FriendPomodoroFunctions['getFriendTodayPomodoros']}
   */
  const getFriendTodayPomodoros = useCallback(async (friendId) => {
    try {
      setLoading(true);
      setError(null);

      const { startOfToday } = getDateRanges();
      const pomodorosRef = collection(db, getUserCollectionPath(friendId, COLLECTIONS.POMODOROS));
      const q = query(
        pomodorosRef,
        where('startTime', '>=', Timestamp.fromDate(startOfToday)),
        orderBy('startTime', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime?.toDate(),
        endTime: doc.data().endTime?.toDate()
      }));
    } catch (error) {
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * フレンドの今週のポモドーロを取得
   * @type {FriendPomodoroFunctions['getFriendWeekPomodoros']}
   */
  const getFriendWeekPomodoros = useCallback(async (friendId) => {
    try {
      setLoading(true);
      setError(null);

      const { startOfWeek } = getDateRanges();
      const pomodorosRef = collection(db, getUserCollectionPath(friendId, COLLECTIONS.POMODOROS));
      const q = query(
        pomodorosRef,
        where('startTime', '>=', Timestamp.fromDate(startOfWeek)),
        orderBy('startTime', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime?.toDate(),
        endTime: doc.data().endTime?.toDate()
      }));
    } catch (error) {
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * ポモドーロの統計情報を計算
   * @type {FriendPomodoroFunctions['getPomodoroStats']}
   */
  const getPomodoroStats = useCallback((pomodoros) => {
    /** @type {PomodoroStats} */
    const stats = {
      totalCount: pomodoros.length,
      totalDuration: 0,
      byCategory: {},
      avgPoseScores: {
        good: 0,
        catSpine: 0,
        shallowSitting: 0,
        distorting: 0
      }
    };

    if (pomodoros.length === 0) return stats;

    pomodoros.forEach(pomo => {
      stats.totalDuration += pomo.duration || 0;

      if (pomo.categoryName) {
        if (!stats.byCategory[pomo.categoryName]) {
          stats.byCategory[pomo.categoryName] = 0;
        }
        stats.byCategory[pomo.categoryName]++;
      }

      stats.avgPoseScores.good += pomo.poseScore.good || 0;
      stats.avgPoseScores.catSpine += pomo.poseScore.catSpine || 0;
      stats.avgPoseScores.shallowSitting += pomo.poseScore.shallowSitting || 0;
      stats.avgPoseScores.distorting += pomo.poseScore.distorting || 0;
    });

    // 各時点でのposeScore合計を計算
    const totalPoseScore = Object.values(stats.avgPoseScores).reduce((sum, value) => sum + value, 0);

    // 割合の計算（パーセント表示）
    if (totalPoseScore > 0) {
      Object.keys(stats.avgPoseScores).forEach(key => {
        stats.avgPoseScores[key] = +((stats.avgPoseScores[key] / totalPoseScore) * 100).toFixed(2);
      });
    }

    return stats;
  }, []);

  return {
    loading,
    error,
    searchUserByUsername,
    sendFriendRequest,
    getReceivedFriendRequests,
    respondToFriendRequest,
    getFriends,
    getFriendTodayPomodoros,
    getFriendWeekPomodoros,
    getPomodoroStats
  };
}