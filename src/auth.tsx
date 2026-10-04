import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { auth, db, googleProvider, isFirebaseConfigured, microsoftProvider } from "./firebase";
import type { Role } from "./types";

type AuthProfile = {
  name: string;
  role: Role;
  studentEmail?: string;
};

type SignupInput = {
  name: string;
  email: string;
  password: string;
  role: Role;
  studentEmail?: string;
};

type AuthContextValue = {
  user: User | null;
  profile: AuthProfile | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string, studentEmail?: string) => Promise<Role>;
  signUp: (input: SignupInput) => Promise<Role>;
  signInWithGoogle: (role?: Role) => Promise<Role>;
  signInWithMicrosoft: (role?: Role) => Promise<Role>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const profileKey = (uid: string) => `readwise-auth-profile:${uid}`;

export type StudentAccount = { uid: string; name: string; email: string };
type StudentDirectoryState = { accounts: StudentAccount[]; available: boolean; loading: boolean };

export function useStudentAccounts() {
  const [state, setState] = useState<StudentDirectoryState>({ accounts: [], available: true, loading: true });
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setState((current) => current.loading
        ? { ...current, available: false, loading: false }
        : current);
    }, 10000);
    const unsubscribe = onSnapshot(
      collection(db, "studentDirectory"),
      (snapshot) => {
        window.clearTimeout(timeout);
        const accounts = snapshot.docs.map((entry) => entry.data() as StudentAccount);
        setState({ accounts, available: true, loading: false });
      },
      () => {
        window.clearTimeout(timeout);
        setState((current) => ({ ...current, available: false, loading: false }));
      },
    );
    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, []);
  return state;
}

export function useStudentAccountByEmail(email?: string | null) {
  const [state, setState] = useState<{ account: StudentAccount | null; available: boolean; loading: boolean }>({ account: null, available: true, loading: Boolean(email) });
  useEffect(() => {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) {
      setState({ account: null, available: true, loading: false });
      return;
    }
    setState((current) => ({ ...current, loading: true }));
    return onSnapshot(doc(db, "studentDirectory", normalizedEmail), (snapshot) => {
      setState({ account: snapshot.exists() ? snapshot.data() as StudentAccount : null, available: true, loading: false });
    }, () => setState({ account: null, available: false, loading: false }));
  }, [email]);
  return state;
}

function fallbackRole(email?: string | null): Role {
  const prefix = email?.split("@")[0]?.toLowerCase() ?? "";
  if (prefix.includes("teacher")) return "teacher";
  if (prefix.includes("parent")) return "parent";
  if (prefix.includes("admin")) return "admin";
  return "student";
}

function readProfile(user: User): AuthProfile {
  const stored = readStoredProfile(user);
  if (stored) return stored;
  return {
    name: user.displayName || user.email?.split("@")[0] || "Readwise User",
    role: fallbackRole(user.email),
  };
}

function readStoredProfile(user: User): AuthProfile | null {
  const stored = localStorage.getItem(profileKey(user.uid));
  if (stored) {
    try {
      const profile: unknown = JSON.parse(stored);
      if (typeof profile === "object" && profile !== null && "name" in profile && typeof profile.name === "string" && "role" in profile && isRole(profile.role)) {
        return {
          name: profile.name,
          role: profile.role,
          ...("studentEmail" in profile && typeof profile.studentEmail === "string" ? { studentEmail: profile.studentEmail } : {}),
        };
      }
    } catch {
      localStorage.removeItem(profileKey(user.uid));
    }
  }
  return null;
}

function isRole(role: unknown): role is Role {
  return role === "student" || role === "teacher" || role === "parent" || role === "admin";
}

function loadProfile(user: User, fallback: AuthProfile = readProfile(user)): Promise<AuthProfile> {
  const storedProfile = readStoredProfile(user);
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve(fallback), 4000);
    void getDoc(doc(db, "accountProfiles", user.uid)).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (isRole(data.role) && typeof data.name === "string") {
          if (data.role === "student" && storedProfile && storedProfile.role !== "student") {
            saveProfile(user, storedProfile);
            resolve(storedProfile);
            return;
          }
          const profile: AuthProfile = {
            name: data.name,
            role: data.role,
            ...(typeof data.studentEmail === "string" ? { studentEmail: data.studentEmail } : {}),
          };
          saveProfile(user, profile);
          resolve(profile);
          return;
        }
      }
      resolve(fallback);
    }).catch((error: unknown) => {
      console.error("Could not load the signed-in account profile from Firestore.", error);
      resolve(fallback);
    }).finally(() => window.clearTimeout(timeout));
  });
}

function saveProfile(user: User, profile: AuthProfile) {
  localStorage.setItem(profileKey(user.uid), JSON.stringify(profile));
}

async function syncAccountDocuments(user: User, profile: AuthProfile) {
  const normalizedEmail = user.email?.trim().toLowerCase();
  await setDoc(doc(db, "accountProfiles", user.uid), {
    uid: user.uid,
    name: profile.name,
    email: normalizedEmail ?? "",
    role: profile.role,
    ...(profile.role === "parent" && profile.studentEmail
      ? { studentEmail: profile.studentEmail.trim().toLowerCase() }
      : {}),
  });
  if (profile.role === "student" && normalizedEmail) {
    await setDoc(doc(db, "studentDirectory", normalizedEmail), {
      uid: user.uid,
      name: profile.name,
      email: normalizedEmail,
    });
  }
}

function syncAccountDocumentsSafely(user: User, profile: AuthProfile) {
  void syncAccountDocuments(user, profile).catch((error: unknown) => {
    console.error("Could not sync the signed-in account to Firestore.", error);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRequest = useRef(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      const requestId = ++profileRequest.current;
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const cachedProfile = readProfile(nextUser);
      setProfile(cachedProfile);
      setLoading(false);
      void loadProfile(nextUser, cachedProfile).then((nextProfile) => {
        if (profileRequest.current !== requestId) return;
        setProfile(nextProfile);
        syncAccountDocumentsSafely(nextUser, nextProfile);
      }).catch((error: unknown) => {
        console.error("Could not load the signed-in account profile from Firestore.", error);
        if (profileRequest.current !== requestId) return;
        setProfile(readProfile(nextUser));
      });
    });

    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    async function signIn(email: string, password: string, studentEmail?: string) {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const requestId = ++profileRequest.current;
      const storedProfile = readProfile(credential.user);
      const nextProfile = storedProfile.role === "parent" && studentEmail
        ? { ...storedProfile, studentEmail: studentEmail.trim().toLowerCase() }
        : storedProfile;
      if (nextProfile !== storedProfile) saveProfile(credential.user, nextProfile);
      if (profileRequest.current === requestId) setProfile(nextProfile);
      void loadProfile(credential.user, nextProfile).then((remoteProfile) => {
        const refreshedProfile = remoteProfile.role === "parent" && studentEmail
          ? { ...remoteProfile, studentEmail: studentEmail.trim().toLowerCase() }
          : remoteProfile;
        if (profileRequest.current === requestId) {
          setProfile(refreshedProfile);
          syncAccountDocumentsSafely(credential.user, refreshedProfile);
        }
      }).catch((error: unknown) => {
        console.error("Could not refresh the signed-in account profile from Firestore.", error);
      });
      if (nextProfile.role === "parent" && studentEmail) syncAccountDocumentsSafely(credential.user, nextProfile);
      return nextProfile.role;
    }

    async function signUp(input: SignupInput) {
      const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);
      await updateProfile(credential.user, { displayName: input.name });
      const nextProfile = {
        name: input.name,
        role: input.role,
        ...(input.role === "parent" && input.studentEmail ? { studentEmail: input.studentEmail } : {}),
      };
      profileRequest.current += 1;
      saveProfile(credential.user, nextProfile);
      syncAccountDocumentsSafely(credential.user, nextProfile);
      setProfile(nextProfile);
      return nextProfile.role;
    }

    async function socialSignIn(provider: typeof googleProvider, role: Role = "student") {
      const credential = await signInWithPopup(auth, provider);
      const requestId = ++profileRequest.current;
      const storedProfile = localStorage.getItem(profileKey(credential.user.uid));
      const fallbackProfile = storedProfile
        ? readProfile(credential.user)
        : {
            name: credential.user.displayName || credential.user.email?.split("@")[0] || "Readwise User",
            role,
          };
      saveProfile(credential.user, fallbackProfile);
      setProfile(fallbackProfile);
      void loadProfile(credential.user, fallbackProfile).then((nextProfile) => {
        if (profileRequest.current === requestId) setProfile(nextProfile);
      }).catch((error: unknown) => {
        console.error("Could not refresh the signed-in account profile from Firestore.", error);
      });
      if (!storedProfile) syncAccountDocumentsSafely(credential.user, fallbackProfile);
      return fallbackProfile.role;
    }

    return {
      user,
      profile,
      loading,
      isConfigured: isFirebaseConfigured,
      signIn,
      signUp,
      signInWithGoogle: (role?: Role) => socialSignIn(googleProvider, role),
      signInWithMicrosoft: (role?: Role) => socialSignIn(microsoftProvider, role),
      resetPassword: (email: string) => sendPasswordResetEmail(auth, email),
      signOut: () => firebaseSignOut(auth),
    };
  }, [loading, profile, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export function routeForRole(role: Role) {
  if (role === "teacher") return "/teacher/dashboard";
  if (role === "parent") return "/parent/dashboard";
  if (role === "admin") return "/admin/dashboard";
  return "/student/dashboard";
}
