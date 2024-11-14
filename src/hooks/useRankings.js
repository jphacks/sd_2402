import { useState, useCallback } from 'react';
import { db } from '../firebase/config';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { COLLECTIONS, getUserCollectionPath } from '../firebase/types';

export function useRankings() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getStartDate = (period) => {
    const now = new Date();
    switch (period) {
      case 'daily': {
        const start = new Date(now.setHours(0, 0, 0, 0));
        console.log('Daily start:', start);
        return start;
      }
      case 'weekly': {
        const start = new Date(now);
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        console.log('Weekly start:', start);
        return start;
      }
      case 'monthly': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        console.log('Monthly start:', start);
        return start;
      }
      default:
        return new Date(now.setHours(0, 0, 0, 0));
    }
  };

  const getPomodoroRanking = useCallback(async (period = 'daily', rankingLimit = 10) => {
    try {
      setLoading(true);
      setError(null);

      const startDate = getStartDate(period);
      console.log('Ranking period start:', startDate);

      const usersRef = collection(db, COLLECTIONS.USERS);
      const userSnap = await getDocs(usersRef);
      const users = userSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('Found users:', users.length);

      const rankings = await Promise.all(
        users.map(async user => {
          const pomodorosRef = collection(db, getUserCollectionPath(user.id, COLLECTIONS.POMODOROS));
          const q = query(
            pomodorosRef,
            where('startTime', '>=', Timestamp.fromDate(startDate)),
            where('mode', '==', 'work')
          );
          
          try {
            const pomodoros = await getDocs(q);
            console.log(`User ${user.displayName} pomodoros:`, pomodoros.size);

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
              stats.goodPosture += pomo.good || 0;
              stats.catSpine += pomo.catSpine || 0;
              stats.shallowSitting += pomo.shallowSitting || 0;
              stats.distorting += pomo.distorting || 0;
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

      console.log('Valid rankings:', validRankings);
      return validRankings;

    } catch (error) {
      console.error('Ranking error:', error);
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getPostureRanking = useCallback(async (period = 'daily', rankingLimit = 10) => {
    try {
      setLoading(true);
      setError(null);

      const startDate = getStartDate(period);
      const usersRef = collection(db, COLLECTIONS.USERS);
      const userSnap = await getDocs(usersRef);
      const users = userSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const rankings = await Promise.all(
        users.map(async user => {
          const pomodorosRef = collection(db, getUserCollectionPath(user.id, COLLECTIONS.POMODOROS));
          const q = query(
            pomodorosRef,
            where('startTime', '>=', Timestamp.fromDate(startDate)),
            where('mode', '==', 'work')
          );

          try {
            const pomodoros = await getDocs(q);
            const stats = {
              userId: user.id,
              username: user.displayName,
              count: 0,
              goodPosture: 0,
              totalDuration: 0
            };

            pomodoros.forEach(doc => {
              const pomo = doc.data();
              stats.count++;
              stats.goodPosture += pomo.good || 0;
              stats.totalDuration += pomo.duration || 0;
            });

            if (stats.count > 0) {
              stats.goodPosture = +(stats.goodPosture / stats.count).toFixed(2);
            }

            return stats;
          } catch (error) {
            console.error(`Error fetching posture data for user ${user.displayName}:`, error);
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