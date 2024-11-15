import { useState, useCallback } from 'react';
import { db } from '../firebase/config';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp,
  doc,
  getDoc 
} from 'firebase/firestore';
import { COLLECTIONS, getUserCollectionPath, FRIEND_REQUEST_STATUS } from '../firebase/types';

export function useRankings() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // フレンドリストの取得処理を修正
  const getFriendsList = async (userId) => {
    try {
      // FRIENDSコレクションから直接フレンドを取得
      const friendsRef = collection(db, getUserCollectionPath(userId, COLLECTIONS.FRIENDS));
      const friendsSnapshot = await getDocs(friendsRef);
      
      const friendIds = friendsSnapshot.docs.map(doc => doc.data().userId);
      console.log('Found friends:', friendIds);
      
      return friendIds;
    } catch (error) {
      console.error('Error fetching friends:', error);
      return [];
    }
  };

  const getStartDate = (period) => {
    const now = new Date();
    switch (period) {
      case 'daily': {
        const start = new Date(now.setHours(0, 0, 0, 0));
        return start;
      }
      case 'weekly': {
        const start = new Date(now);
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        return start;
      }
      case 'monthly': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return start;
      }
      default:
        return new Date(now.setHours(0, 0, 0, 0));
    }
  };

  // ユーザー情報の一括取得
  const getUsersInfo = async (userIds) => {
    const users = await Promise.all(
      userIds.map(async (userId) => {
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
        if (userDoc.exists()) {
          return {
            id: userDoc.id,
            ...userDoc.data()
          };
        }
        return null;
      })
    );
    return users.filter(user => user !== null);
  };

  const getPomodoroRanking = useCallback(async (period = 'daily', rankingLimit = 10, currentUserId) => {
    try {
      setLoading(true);
      setError(null);

      // フレンドリストを取得
      const friendIds = await getFriendsList(currentUserId);
      const targetUserIds = [currentUserId, ...friendIds];

      // ユーザー情報を一括取得
      const users = await getUsersInfo(targetUserIds);
      console.log('Target users:', users);

      const rankings = await Promise.all(
        users.map(async user => {
          const pomodorosRef = collection(db, getUserCollectionPath(user.id, COLLECTIONS.POMODOROS));
          const q = query(
            pomodorosRef,
            where('startTime', '>=', Timestamp.fromDate(getStartDate(period))),
            where('mode', '==', 'work')
          );
          
          try {
            const pomodoros = await getDocs(q);
            const stats = {
              userId: user.id,
              username: user.displayName,
              count: 0,
              totalDuration: 0,
              goodPosture: 0,
              catSpine: 0,
              shallowSitting: 0,
              distorting: 0
            };

            pomodoros.forEach(doc => {
              const pomo = doc.data();
              stats.count++;
              stats.totalDuration += pomo.duration || 0;
              stats.goodPosture += pomo.poseScore.good || 0;
              stats.catSpine += pomo.poseScore.catSpine || 0;
              stats.shallowSitting += pomo.poseScore.shallowSitting || 0;
              stats.distorting += pomo.poseScore.distorting || 0;
            });

            if (stats.count > 0) {
              stats.goodPosture = +(stats.goodPosture / stats.count).toFixed(2);
              stats.catSpine = +(stats.catSpine / stats.count).toFixed(2);
              stats.shallowSitting = +(stats.shallowSitting / stats.count).toFixed(2);
              stats.distorting = +(stats.distorting / stats.count).toFixed(2);
            }

            return stats;
          } catch (error) {
            console.error(`Error fetching pomodoros for user ${user.displayName}:`, error);
            return null;
          }
        })
      );

      const validRankings = rankings
        .filter(rank => rank !== null && rank.count > 0)
        .sort((a, b) => {
          if (b.count !== a.count) {
            return b.count - a.count;
          }
          return b.totalDuration - a.totalDuration;
        })
        .slice(0, rankingLimit);

      return validRankings;

    } catch (error) {
      console.error('Ranking error:', error);
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getPostureRanking = useCallback(async (period = 'daily', rankingLimit = 10, currentUserId) => {
    try {
      setLoading(true);
      setError(null);

      // フレンドリストを取得
      const friendIds = await getFriendsList(currentUserId);
      const targetUserIds = [currentUserId, ...friendIds];

      // ユーザー情報を一括取得
      const users = await getUsersInfo(targetUserIds);

      const rankings = await Promise.all(
        users.map(async user => {
          const pomodorosRef = collection(db, getUserCollectionPath(user.id, COLLECTIONS.POMODOROS));
          const q = query(
            pomodorosRef,
            where('startTime', '>=', Timestamp.fromDate(getStartDate(period))),
            where('mode', '==', 'work')
          );

          try {
            const pomodoros = await getDocs(q);
            const stats = {
              userId: user.id,
              username: user.displayName,
              count: 0,
              totalDuration: 0,
              goodPosture: 0,
              catSpine: 0,
              shallowSitting: 0,
              distorting: 0
            };

            pomodoros.forEach(doc => {
              const pomo = doc.data();
              stats.count++;
              stats.totalDuration += pomo.duration || 0;
              stats.goodPosture += pomo.poseScore.good || 0;
              stats.catSpine += pomo.poseScore.catSpine || 0;
              stats.shallowSitting += pomo.poseScore.shallowSitting || 0;
              stats.distorting += pomo.poseScore.distorting || 0;
            });

            if (stats.count > 0) {
              // 姿勢スコアの合計を計算
              const totalPoseScore = stats.goodPosture + stats.catSpine + 
                                   stats.shallowSitting + stats.distorting;
              
              // 各姿勢スコアを割合（パーセント）に変換
              if (totalPoseScore > 0) {
                stats.goodPosture = +((stats.goodPosture / totalPoseScore) * 100).toFixed(2);
                stats.catSpine = +((stats.catSpine / totalPoseScore) * 100).toFixed(2);
                stats.shallowSitting = +((stats.shallowSitting / totalPoseScore) * 100).toFixed(2);
                stats.distorting = +((stats.distorting / totalPoseScore) * 100).toFixed(2);
              }
            }

            return stats;
          } catch (error) {
            console.error(`Error fetching pomodoros for user ${user.displayName}:`, error);
            return null;
          }
        })
      );

      const validRankings = rankings
        .filter(rank => rank !== null && rank.count > 0)
        .sort((a, b) => b.goodPosture - a.goodPosture)
        .slice(0, rankingLimit);

      return validRankings;
    } catch (error) {
      console.error('Posture ranking error:', error);
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getPomodoroRanking,
    getPostureRanking
  };
}