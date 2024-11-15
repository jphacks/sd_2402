import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";
import { auth, db } from "../firebase/config";
import { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { COLLECTIONS, getUserCollectionPath } from "../firebase/types";

export const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * ユーザーのusernameサブコレクションに履歴を保存
   * @param {string} uid - ユーザーID
   * @param {string} username - ユーザー名
   */
  async function saveUsernameHistory(uid, username) {
    try {
      const usernamesRef = collection(db, getUserCollectionPath(uid, COLLECTIONS.USERNAMES));
      
      /** @type {UsernameHistory} */
      const usernameData = {
        username: username,
        createdAt: serverTimestamp()
      };
      
      const result = await addDoc(usernamesRef, usernameData);
      console.log('Username history saved:', result.id);
    } catch (error) {
      console.error('Error saving username history:', error);
      throw error;
    }
  }

  async function signup(email, password) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 初期ユーザー名をメールアドレスの@前の部分に設定
      const initialUsername = email.split('@')[0];
      
      // Firebase Authのプロフィールを更新
      await updateProfile(user, {
        displayName: initialUsername
      });

      /** @type {User} */
      const userData = {
        email: user.email,
        displayName: initialUsername,
        createdAt: serverTimestamp()
      };
      
      // ユーザードキュメントを作成
      await setDoc(doc(db, COLLECTIONS.USERS, user.uid), userData);

      // ユーザー名履歴を保存
      await saveUsernameHistory(user.uid, initialUsername);

      return userCredential;
    } catch (error) {
      console.error("Error in signup:", error);
      throw error;
    }
  }

  function signin(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  async function updateUsername(newUsername) {
    try {
      if (!currentUser) throw new Error('ログインユーザーが存在しません');

      // Firebase Authのプロフィールを更新
      await updateProfile(currentUser, { 
        displayName: newUsername 
      });

      // usersコレクションのドキュメントを更新
      const userDocRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
      const updateData = { 
        displayName: newUsername,
        updatedAt: serverTimestamp()
      };
      await updateDoc(userDocRef, updateData);

      // ユーザー名履歴を保存
      await saveUsernameHistory(currentUser.uid, newUsername);

      console.log('Username updated successfully');
    } catch (error) {
      console.error("Error updating username:", error);
      throw new Error('ユーザー名の更新に失敗しました: ' + error.message);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    signup,
    signin,
    logout,
    updateUsername
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}