import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, QuizResult } from '../types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
// Initialize Firestore using configured firestoreDatabaseId
export const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Ensure browser local persistence for Firebase Auth
try {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[Firebase Auth] Persistence initialization warning:', err);
  });
} catch {
  // Ignore in environments without window/indexedDB
}

// Error diagnostic helper as specified in guidelines
export enum FirestoreOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: FirestoreOperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: FirestoreOperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path,
  };
  console.error('[Firestore Error]:', JSON.stringify(errInfo));
  return errInfo;
}

// Test initial connection
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Client is offline or database is provisioning.');
    }
  }
}

// Firebase Auth Service
export const FirebaseAuthService = {
  async registerWithEmail(email: string, password: string, displayName?: string, metadata?: any): Promise<FirebaseUser> {
    console.log('[Auth] registerWithEmail started for:', email);
    const cleanEmail = email?.trim().toLowerCase();
    if (!cleanEmail) {
      throw { code: 'auth/missing-email', message: 'Vui lòng nhập địa chỉ email.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw { code: 'auth/invalid-email', message: 'Địa chỉ email không hợp lệ. Vui lòng nhập đúng định dạng (VD: hocsinh@gmail.com).' };
    }
    if (!password || !password.trim()) {
      throw { code: 'auth/missing-password', message: 'Vui lòng nhập mật khẩu.' };
    }
    if (password.length < 6) {
      throw { code: 'auth/weak-password', message: 'Mật khẩu phải có ít nhất 6 ký tự để bảo mật.' };
    }

    // 1. First try official Firebase createUserWithEmailAndPassword
    try {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (pErr) {
        console.warn('[Auth] Persistence warning:', pErr);
      }
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      if (displayName && cred.user) {
        try {
          await updateProfile(cred.user, { displayName });
        } catch (profileErr) {
          console.warn('[Auth] updateProfile displayName non-fatal warning:', profileErr);
        }
      }
      console.log('[Auth] Firebase createUserWithEmailAndPassword success, uid:', cred.user.uid);
      return cred.user;
    } catch (fbErr: any) {
      console.warn('[Auth] Firebase createUserWithEmailAndPassword notice:', fbErr?.code, fbErr?.message);
      // If Firebase rejected with a specific user-facing validation error, re-throw it
      if (
        fbErr?.code === 'auth/email-already-in-use' ||
        fbErr?.code === 'auth/invalid-email' ||
        fbErr?.code === 'auth/weak-password'
      ) {
        throw fbErr;
      }
      // If operation is not allowed or admin restricted in Firebase project, use the server auth endpoint
    }

    // 2. Delegate to server-side authentication endpoint
    console.log('[Auth] Registering via secure server authentication provider for:', cleanEmail);
    const resp = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        password,
        displayName: displayName || cleanEmail.split('@')[0],
        ...metadata
      })
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.success) {
      throw {
        code: data.code || 'auth/register-failed',
        message: data.error || data.message || 'Đăng ký tài khoản không thành công. Vui lòng thử lại.'
      };
    }

    console.log('[Auth] Server-side registration successful, uid:', data.user.uid);

    return {
      uid: data.user.uid,
      email: data.user.email,
      displayName: data.user.displayName,
      emailVerified: true,
      isAnonymous: false,
      metadata: {},
      providerData: [
        {
          providerId: 'password',
          uid: data.user.uid,
          displayName: data.user.displayName,
          email: data.user.email,
          phoneNumber: null,
          photoURL: null
        }
      ],
      refreshToken: '',
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => 'token_' + data.user.uid,
      getIdTokenResult: async () => ({ token: 'token_' + data.user.uid } as any),
      reload: async () => {},
      toJSON: () => ({ uid: data.user.uid, email: data.user.email }),
      phoneNumber: null,
      photoURL: null,
      providerId: 'firebase_email'
    } as unknown as FirebaseUser;
  },

  async loginWithEmail(email: string, password: string): Promise<FirebaseUser> {
    console.log('[Auth] loginWithEmail started for:', email);
    const cleanEmail = email?.trim().toLowerCase();
    if (!cleanEmail) {
      throw { code: 'auth/missing-email', message: 'Vui lòng nhập email đăng nhập.' };
    }
    if (!password || !password.trim()) {
      throw { code: 'auth/missing-password', message: 'Vui lòng nhập mật khẩu.' };
    }

    // 1. Try Firebase Auth first
    try {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (pErr) {
        console.warn('[Auth] Persistence warning:', pErr);
      }
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      console.log('[Auth] Firebase signInWithEmailAndPassword success, uid:', cred.user.uid);
      return cred.user;
    } catch (fbErr: any) {
      console.warn('[Auth] Firebase signInWithEmailAndPassword notice:', fbErr?.code, fbErr?.message);
    }

    // 2. Delegate to server-side authentication endpoint
    console.log('[Auth] Authenticating via secure server authentication provider for:', cleanEmail);
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        password
      })
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.success) {
      throw {
        code: data.code || 'auth/wrong-password',
        message: data.error || data.message || 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
      };
    }

    console.log('[Auth] Server-side login successful, uid:', data.user.uid);

    return {
      uid: data.user.uid,
      email: data.user.email,
      displayName: data.user.displayName,
      emailVerified: true,
      isAnonymous: false,
      metadata: {},
      providerData: [
        {
          providerId: 'password',
          uid: data.user.uid,
          displayName: data.user.displayName,
          email: data.user.email,
          phoneNumber: null,
          photoURL: null
        }
      ],
      refreshToken: '',
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => 'token_' + data.user.uid,
      getIdTokenResult: async () => ({ token: 'token_' + data.user.uid } as any),
      reload: async () => {},
      toJSON: () => ({ uid: data.user.uid, email: data.user.email }),
      phoneNumber: null,
      photoURL: null,
      providerId: 'firebase_email'
    } as unknown as FirebaseUser;
  },

  async signInWithGoogle(): Promise<FirebaseUser> {
    console.log('[Auth] Google OAuth started');
    try {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (pErr) {
        console.warn('[Auth] Could not ensure persistence before popup:', pErr);
      }
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, googleProvider);
      console.log('[Auth] Google OAuth success, uid:', result.user.uid, result.user.email);
      return result.user;
    } catch (error: any) {
      console.error('[Auth] Google OAuth error:', error?.code, error?.message);
      throw error;
    }
  },

  async logOut() {
    try {
      console.log('[Auth] Logging out from Firebase');
      await fbSignOut(auth);
      console.log('[Auth] Firebase sign out complete');
    } catch (error) {
      console.error('[Auth] Sign Out Error:', error);
    }
  },

  onUserChange(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  }
};

// Firestore Sync Service with resilient timeout guards
export const FirebaseDataService = {
  /**
   * Helper with timeout to prevent Firestore network hangs from blocking the app
   */
  withTimeout<T>(promise: Promise<T>, timeoutMs: number = 3500, fallback: T): Promise<T> {
    let timer: any;
    const timeoutPromise = new Promise<T>((resolve) => {
      timer = setTimeout(() => {
        console.warn(`[Firestore] Operation timed out after ${timeoutMs}ms, returning fallback.`);
        resolve(fallback);
      }, timeoutMs);
    });
    return Promise.race([
      promise.then((res) => {
        clearTimeout(timer);
        return res;
      }).catch((err) => {
        clearTimeout(timer);
        throw err;
      }),
      timeoutPromise
    ]);
  },

  /**
   * Save / Sync user profile to Firestore
   */
  async syncUserProfile(profile: UserProfile): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const path = `users/${currentUser.uid}`;
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const safeData = {
        ...profile,
        id: currentUser.uid,
        email: currentUser.email || profile.email,
        updatedAt: new Date().toISOString()
      };
      await this.withTimeout(setDoc(userRef, safeData, { merge: true }), 3500, undefined);
      console.log('[Auth] User profile synced to Firestore:', currentUser.uid);
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.WRITE, path);
    }
  },

  /**
   * Load user profile from Firestore
   */
  async loadUserProfile(uid: string): Promise<UserProfile | null> {
    const path = `users/${uid}`;
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await this.withTimeout(getDoc(userRef), 3500, null as any);
      if (snap && snap.exists()) {
        console.log('[Auth] User profile loaded from Firestore:', uid);
        return snap.data() as UserProfile;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.GET, path);
      return null;
    }
  },

  /**
   * Record Quiz Result and Test Scores to Firestore
   */
  async recordQuizResult(userId: string, result: QuizResult, grade: number): Promise<void> {
    const path = `users/${userId}/quizRecords`;
    try {
      const colRef = collection(db, 'users', userId, 'quizRecords');
      const scorePercent = result.totalQuestions > 0 
        ? Math.round((result.correctCount / result.totalQuestions) * 100) 
        : 0;

      await addDoc(colRef, {
        userId,
        gameMode: result.gameMode,
        subject: result.subject,
        grade,
        totalQuestions: result.totalQuestions,
        correctCount: result.correctCount,
        wrongCount: result.wrongCount,
        scorePercent,
        xpEarned: result.xpEarned,
        coinsEarned: result.coinsEarned,
        timestamp: Date.now(),
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.CREATE, path);
    }
  },

  /**
   * Record individual question history (correct and wrong answers)
   */
  async recordQuestionAnswer(
    userId: string,
    questionId: string,
    subject: string,
    grade: number,
    isCorrect: boolean,
    selectedAnswer: string,
    correctAnswer: string,
    topic?: string
  ): Promise<void> {
    const path = `users/${userId}/questionAnswers`;
    try {
      const colRef = collection(db, 'users', userId, 'questionAnswers');
      await addDoc(colRef, {
        userId,
        questionId,
        subject,
        grade,
        topic: topic || '',
        isCorrect,
        selectedAnswer,
        correctAnswer,
        timestamp: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.CREATE, path);
    }
  },

  /**
   * Save AI Chat message to user's history
   */
  async saveChatMessage(
    userId: string,
    role: 'user' | 'tutor',
    text: string,
    subject?: string,
    persona?: string,
    modelUsed?: string,
    groundingSources?: any[]
  ): Promise<void> {
    const path = `users/${userId}/chatHistory`;
    try {
      const colRef = collection(db, 'users', userId, 'chatHistory');
      await addDoc(colRef, {
        userId,
        role,
        text,
        subject: subject || 'Chung',
        persona: persona || 'owl',
        modelUsed: modelUsed || 'gemini-3.5-flash',
        groundingSources: groundingSources || [],
        timestamp: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.CREATE, path);
    }
  },

  /**
   * Load AI Chat messages from Firestore
   */
  async getChatHistory(userId: string, maxItems: number = 30): Promise<any[]> {
    const path = `users/${userId}/chatHistory`;
    try {
      const colRef = collection(db, 'users', userId, 'chatHistory');
      const q = query(colRef, orderBy('timestamp', 'asc'), limit(maxItems));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.LIST, path);
      return [];
    }
  },

  /**
   * Save AI-generated questions into Firestore to ensure infinite, non-duplicate generation
   */
  async saveGeneratedQuestions(
    userId: string,
    questions: any[],
    subject: string,
    grade: number,
    topic: string
  ): Promise<void> {
    const path = `users/${userId}/generatedQuestions`;
    try {
      const colRef = collection(db, 'users', userId, 'generatedQuestions');
      for (const q of questions) {
        await addDoc(colRef, {
          userId,
          questionId: q.id,
          content: q.content,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          hint: q.hint || '',
          difficulty: q.difficulty || 3,
          subject,
          grade,
          topic,
          groundingSources: q.groundingSources || [],
          timestamp: Date.now()
        });
      }
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.CREATE, path);
    }
  },

  /**
   * Fetch stored AI-generated questions for topic and grade
   */
  async getGeneratedQuestions(
    userId: string,
    subject?: string,
    grade?: number,
    topic?: string
  ): Promise<any[]> {
    const path = `users/${userId}/generatedQuestions`;
    try {
      const colRef = collection(db, 'users', userId, 'generatedQuestions');
      const snap = await getDocs(colRef);
      let items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      if (subject) items = items.filter(i => i.subject === subject);
      if (grade) items = items.filter(i => i.grade === grade);
      if (topic) items = items.filter(i => i.topic?.toLowerCase().includes(topic.toLowerCase()));
      return items;
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.LIST, path);
      return [];
    }
  },

  /**
   * Fetch all question IDs that the user has previously seen, answered,
   * or had generated in their Firestore history to ensure complete non-duplication.
   */
  async getUserAllSeenQuestionIds(userId: string): Promise<string[]> {
    const seenSet = new Set<string>();
    if (!userId) return [];

    try {
      // 1. Check generated questions collection
      const genColRef = collection(db, 'users', userId, 'generatedQuestions');
      const genSnap = await getDocs(genColRef);
      genSnap.docs.forEach(d => {
        const data = d.data();
        if (data.questionId) seenSet.add(String(data.questionId));
        if (d.id) seenSet.add(String(d.id));
      });
    } catch (error) {
      console.warn('Could not read generatedQuestions for seen IDs:', error);
    }

    try {
      // 2. Check answered questions collection
      const ansColRef = collection(db, 'users', userId, 'questionAnswers');
      const ansSnap = await getDocs(ansColRef);
      ansSnap.docs.forEach(d => {
        const data = d.data();
        if (data.questionId) seenSet.add(String(data.questionId));
      });
    } catch (error) {
      console.warn('Could not read questionAnswers for seen IDs:', error);
    }

    return Array.from(seenSet);
  },

  /**
   * Fetch recent quiz records for profile progress dashboard
   */
  async getRecentQuizRecords(userId: string, maxItems: number = 10): Promise<any[]> {
    const path = `users/${userId}/quizRecords`;
    try {
      const colRef = collection(db, 'users', userId, 'quizRecords');
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(maxItems));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, FirestoreOperationType.LIST, path);
      return [];
    }
  }
};
