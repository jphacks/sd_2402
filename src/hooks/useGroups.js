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
  Timestamp,
  serverTimestamp,
  getDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import {
  COLLECTIONS,
  GROUP_INVITATION_STATUS,
  getUserCollectionPath,
} from '../firebase/types';

export function useGroups() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * グループを作成
   * @param {string} userId - 作成者のUID
   * @param {{ name: string, description: string }} groupData - グループ情報
   */
  const createGroup = useCallback(async (userId, groupData) => {
    try {
      setLoading(true);
      setError(null);
  
      const groupsRef = collection(db, COLLECTIONS.GROUPS);
      const newGroup = {
        name: groupData.name,
        description: groupData.description,
        ownerId: userId,
        memberIds: [userId],
        categoryIds: [], // 明示的に空の配列として初期化
        createdAt: serverTimestamp(),
      };
  
      await addDoc(groupsRef, newGroup);
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * グループにメンバーを招待
   * @param {string} groupId - グループID
   * @param {Object} fromUser - 招待者情報
   * @param {Object} toUser - 被招待者情報
   */
  const inviteToGroup = useCallback(async (groupId, fromUser, toUser) => {
    try {
      setLoading(true);
      setError(null);
  
      const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (!groupDoc.exists()) {
        throw new Error('グループが存在しません');
      }
  
      const groupData = groupDoc.data();
      if (!groupData.memberIds.includes(fromUser.uid)) {
        throw new Error('グループのメンバーのみが招待できます');
      }
  
      if (groupData.memberIds.includes(toUser.uid)) {
        throw new Error('既にグループのメンバーです');
      }
  
      const invitationsRef = collection(db, COLLECTIONS.GROUP_INVITATIONS);
      const existingInvite = await getDocs(
        query(
          invitationsRef,
          where('groupId', '==', groupId),
          where('toUserId', '==', toUser.uid),
          where('status', '==', GROUP_INVITATION_STATUS.PENDING)
        )
      );
  
      if (!existingInvite.empty) {
        throw new Error('既に招待を送信しています');
      }
  
      const invitation = {
        groupId,
        groupName: groupData.name,
        fromUserId: fromUser.uid,
        fromUsername: fromUser.displayName,
        toUserId: toUser.uid,
        toUsername: toUser.displayName,
        status: GROUP_INVITATION_STATUS.PENDING,
        createdAt: serverTimestamp(),
      };
  
      await addDoc(invitationsRef, invitation);
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * グループ招待に応答
   * @param {string} invitationId - 招待ID
   * @param {string} userId - 応答者のUID
   * @param {string} response - 応答（accepted/rejected）
   */
  const respondToGroupInvitation = useCallback(async (invitationId, userId, response) => {
    try {
      setLoading(true);
      setError(null);

      const invitationRef = doc(db, COLLECTIONS.GROUP_INVITATIONS, invitationId);
      const invitation = await getDoc(invitationRef);

      if (!invitation.exists()) {
        throw new Error('招待が見つかりません');
      }

      const invitationData = invitation.data();
      if (invitationData.toUserId !== userId) {
        throw new Error('この招待に応答する権限がありません');
      }

      await updateDoc(invitationRef, {
        status: response,
        updatedAt: serverTimestamp(),
      });

      if (response === GROUP_INVITATION_STATUS.ACCEPTED) {
        const groupRef = doc(db, COLLECTIONS.GROUPS, invitationData.groupId);
        await updateDoc(groupRef, {
          memberIds: arrayUnion(userId),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * グループの共有カテゴリーを追加・削除
   * @param {string} groupId - グループID
   * @param {string} categoryId - カテゴリーID
   * @param {boolean} add - true: 追加, false: 削除
   */
  const updateGroupCategories = useCallback(async (groupId, categoryId, add) => {
    try {
      setLoading(true);
      setError(null);

      const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
      await updateDoc(groupRef, {
        categoryIds: add ? arrayUnion(categoryId) : arrayRemove(categoryId),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * グループのポモドーロ統計を取得
   * @param {string} groupId - グループID
   * @param {Date} startDate - 開始日
   * @param {Date} endDate - 終了日
   */
  // useGroups.js の getGroupPomodoroStats 関数を修正
   const getGroupPomodoroStats = useCallback(async (groupId, startDate, endDate) => {
    try {
      setLoading(true);
      setError(null);
  
      const groupRef = doc(db, COLLECTIONS.GROUPS, groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (!groupDoc.exists()) {
        throw new Error('グループが見つかりません');
      }
  
      const groupData = groupDoc.data();
      const memberStats = {};
  
      // 各メンバーのポモドーロを取得
      for (const memberId of groupData.memberIds) {
        const pomodorosRef = collection(db, getUserCollectionPath(memberId, COLLECTIONS.POMODOROS));
        
        // 基本のクエリ条件（日付フィルタ）
        const queryConditions = [
          where('startTime', '>=', Timestamp.fromDate(startDate)),
          where('startTime', '<=', Timestamp.fromDate(endDate))
        ];
  
        // カテゴリーフィルタは、categoryIdsが配列で、かつ空でない場合のみ追加
        if (Array.isArray(groupData.categoryIds) && groupData.categoryIds.length > 0) {
          queryConditions.push(where('categoryId', 'in', groupData.categoryIds));
        }
  
        const q = query(
          pomodorosRef,
          ...queryConditions
        );
  
        const querySnapshot = await getDocs(q);
        const pomodoros = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          startTime: doc.data().startTime?.toDate(),
          endTime: doc.data().endTime?.toDate()
        }));
  
        memberStats[memberId] = pomodoros;
      }
  
      return {
        groupId,
        groupName: groupData.name,
        categoryIds: Array.isArray(groupData.categoryIds) ? groupData.categoryIds : [],
        memberStats,
      };
    } catch (error) {
      console.error('Error in getGroupPomodoroStats:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * ユーザーの所属グループを取得
   * @param {string} userId - ユーザーID
   */
  const getUserGroups = useCallback(async (userId) => {
    try {
      setLoading(true);
      setError(null);

      const groupsRef = collection(db, COLLECTIONS.GROUPS);
      const q = query(groupsRef, where('memberIds', 'array-contains', userId));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 受信したグループ招待を取得
   * @param {string} userId - ユーザーID
   */
  const getReceivedGroupInvitations = useCallback(async (userId) => {
    try {
      setLoading(true);
      setError(null);

      const invitationsRef = collection(db, COLLECTIONS.GROUP_INVITATIONS);
      const q = query(
        invitationsRef,
        where('toUserId', '==', userId),
        where('status', '==', GROUP_INVITATION_STATUS.PENDING)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    createGroup,
    inviteToGroup,
    respondToGroupInvitation,
    updateGroupCategories,
    getGroupPomodoroStats,
    getUserGroups,
    getReceivedGroupInvitations,
  };
}