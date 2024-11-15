/**
 * Firestore collections and document types
 */

/**
 * @typedef Pomodoro
 * @property {Date} startTime - ポモドーロの開始時間
 * @property {Date} endTime - ポモドーロの終了時間
 * @property {string} categoryId - カテゴリーID
 * @property {string} categoryName - カテゴリー名
 * @property {string} taskName - タスク名
 * @property {number} duration - 作業時間（分）
 * @property {('work'|'break')} mode - 作業モード
 * @property {number} good - 良い姿勢のスコア
 * @property {number} catSpine - 猫背のスコア
 * @property {number} shallowSitting - 浅座りのスコア
 * @property {number} distorting - 歪んだ姿勢のスコア
 */

/**
 * @typedef PomodoroStats
 * @property {number} totalCount - 総ポモドーロ数
 * @property {number} totalDuration - 総作業時間（分）
 * @property {Object.<string, number>} byCategory - カテゴリー別のポモドーロ数
 * @property {Object} avgPoseScores - 平均姿勢スコア
 * @property {number} avgPoseScores.good - 良い姿勢の平均スコア
 * @property {number} avgPoseScores.catSpine - 猫背の平均スコア
 * @property {number} avgPoseScores.shallowSitting - 浅座りの平均スコア
 * @property {number} avgPoseScores.distorting - 歪みの平均スコア
 */

/**
 * @typedef Category
 * @property {string} name - カテゴリー名
 * @property {Date} createdAt - 作成日時
 */

/**
 * @typedef UsernameHistory
 * @property {string} username - ユーザー名
 * @property {Date} createdAt - 作成日時
 */

/**
 * @typedef User
 * @property {string} email - ユーザーのメールアドレス
 * @property {string} displayName - 表示名
 * @property {Date} createdAt - アカウント作成日時
 * @property {Date} [updatedAt] - 最終更新日時（オプション）
 */

/**
 * @typedef Friend
 * @property {string} userId - フレンドのUID
 * @property {string} username - フレンドのユーザー名
 * @property {Date} createdAt - フレンド登録日時
 */

/**
 * @typedef FriendRequest
 * @property {string} fromUserId - リクエスト送信者のUID
 * @property {string} fromUsername - リクエスト送信者のユーザー名
 * @property {string} toUserId - リクエスト受信者のUID
 * @property {string} toUsername - リクエスト受信者のユーザー名
 * @property {string} status - リクエストのステータス（pending/accepted/rejected）
 * @property {Date} createdAt - リクエスト作成日時
 * @property {Date} [updatedAt] - ステータス更新日時
 */

/**
 * @typedef Group
 * @property {string} id - グループID
 * @property {string} name - グループ名
 * @property {string} description - グループの説明
 * @property {string} ownerId - グループ作成者のUID
 * @property {string[]} memberIds - メンバーのUID配列
 * @property {string[]} categoryIds - 共有カテゴリーID配列
 * @property {Date} createdAt - 作成日時
 * @property {Date} [updatedAt] - 更新日時
 */

/**
 * @typedef GroupInvitation
 * @property {string} groupId - グループID
 * @property {string} groupName - グループ名
 * @property {string} fromUserId - 招待者のUID
 * @property {string} fromUsername - 招待者のユーザー名
 * @property {string} toUserId - 被招待者のUID
 * @property {string} toUsername - 被招待者のユーザー名
 * @property {string} status - 招待のステータス
 * @property {Date} createdAt - 作成日時
 * @property {Date} [updatedAt] - 更新日時
 */

/**
 * Firestoreのコレクション名を管理
 */
export const COLLECTIONS = {
  USERS: 'users',
  POMODOROS: 'pomodoros',
  CATEGORIES: 'categories',
  USERNAMES: 'usernames',
  FRIEND_REQUESTS: 'friendRequests',
  FRIENDS: 'friends',
  GROUPS: 'groups',
  GROUP_INVITATIONS: 'groupInvitations',
};

/**
 * フレンドリクエストのステータス
 */
export const FRIEND_REQUEST_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected'
};

export const GROUP_INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

/**
 * @typedef FriendPomodoroFunctions
 * @property {(friendId: string) => Promise<Pomodoro[]>} getFriendTodayPomodoros - フレンドの今日のポモドーロを取得
 * @property {(friendId: string) => Promise<Pomodoro[]>} getFriendWeekPomodoros - フレンドの今週のポモドーロを取得
 * @property {(pomodoros: Pomodoro[]) => PomodoroStats} getPomodoroStats - ポモドーロの統計情報を計算
 */

/**
 * @typedef FriendManagementFunctions
 * @property {(username: string) => Promise<User[]>} searchUserByUsername - ユーザー名でユーザーを検索
 * @property {(fromUser: User, toUser: User) => Promise<void>} sendFriendRequest - フレンドリクエストを送信
 * @property {(userId: string) => Promise<FriendRequest[]>} getReceivedFriendRequests - 受信したフレンドリクエストを取得
 * @property {(requestId: string, userId: string, response: string) => Promise<void>} respondToFriendRequest - フレンドリクエストに応答
 * @property {(userId: string) => Promise<Friend[]>} getFriends - フレンドリストを取得
 */

/**
 * ユーザーごとのサブコレクションのパスを取得
 * @param {string} userId - ユーザーID
 * @param {string} collection - コレクション名
 * @returns {string} コレクションパス
 */
export const getUserCollectionPath = (userId, collection) => {
  return `${COLLECTIONS.USERS}/${userId}/${collection}`;
};

/**
 * 日付の範囲を取得
 * @returns {{ startOfToday: Date, startOfWeek: Date }}
 */
export const getDateRanges = () => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  return { startOfToday, startOfWeek };
};
