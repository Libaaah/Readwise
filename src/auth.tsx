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

export type StudentAccount = { uid: string; name: string; email: string };
type StudentDirectoryState = { accounts: StudentAccount[]; available: boolean; loading: boolean };

export function useStudentAccounts() {
  const [state, setState] = useState<StudentDirectoryState>({ accounts: [], available: true, loading: true });
  useEffect(() => {
    let directoryAccounts: StudentAccount[] = [];
    let profileAccounts: StudentAccount[] = [];
    let directoryLoaded = false;
    let profilesLoaded = false;
    let directoryAvailable = true;
    let profilesAvailable = true;
    const loadingTimeout = window.setTimeout(() => {
      if (!directoryLoaded) {
        directoryLoaded = true;
        directoryAvailable = false;
      }
      if (!profilesLoaded) {
        profilesLoaded = true;
        profilesAvailable = false;
      }
      publish();
    }, 10000);
    const publish = () => {
      if (directoryLoaded && profilesLoaded) window.clearTimeout(loadingTimeout);
      const merged = new Map<string, StudentAccount>();
      for (const account of directoryAccounts) merged.set(account.uid, account);
      for (const account of profileAccounts) {
        const existing = merged.get(account.uid);
        merged.set(account.uid, { ...existing, ...account, name: account.name || existing?.name || account.email });
      }
      setState({
        accounts: [...merged.values()].sort((left, right) => left.name.localeCompare(right.name)),
        available: directoryAvailable || profilesAvailable,
        loading: !(directoryLoaded && profilesLoaded),
      });
    };
    const unsubscribeDirectory = onSnapshot(
      collection(db, "studentDirectory"),
      (snapshot) => {
        directoryLoaded = true;
        directoryAccounts = snapshot.docs
          .map((entry) => entry.data() as StudentAccount)
          .filter((account) => Boolean(account.uid && account.email));
        publish();
      },
      () => {
        directoryLoaded = true;
        directoryAvailable = false;
        publish();
      },
    );
    const unsubscribeProfiles = onSnapshot(
      collection(db, "accountProfiles"),
      (snapshot) => {
        profilesLoaded = true;
        profileAccounts = snapshot.docs
          .filter((entry) => entry.data().role === "student")
          .map((entry) => ({
            uid: entry.id,
            name: typeof entry.data().name === "string" ? entry.data().name : "",
            email: typeof entry.data().email === "string" ? entry.data().email : "",
          }))
          .filter((account) => Boolean(account.email));
        publish();
      },
      () => {
        profilesLoaded = true;
        profilesAvailable = false;
        publish();
      },
    );
    return () => {
      window.clearTimeout(loadingTimeout);
      unsubscribeDirectory();
      unsubscribeProfiles();
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

function isRole(role: unknown): role is Role {
  return role === "student" || role === "teacher" || role === "parent" || role === "admin";
}

function loadProfile(user: User): Promise<AuthProfile | null> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Timed out loading the Firebase account role.")), 4000);
    void getDoc(doc(db, "accountProfiles", user.uid)).then((snapshot) => {
      if (!snapshot.exists()) {
        resolve(null);
        return;
      }
      const data = snapshot.data();
      if (!isRole(data.role) || typeof data.name !== "string") {
        resolve(null);
        return;
      }
      resolve({
        name: data.name,
        role: data.role,
        ...(typeof data.studentEmail === "string" ? { studentEmail: data.studentEmail } : {}),
      });
    }).catch((error: unknown) => {
      console.error("Could not load the signed-in account profile from Firestore.", error);
      reject(error);
    }).finally(() => window.clearTimeout(timeout));
  });
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
      setProfile(null);
      setLoading(true);
      void loadProfile(nextUser).then((nextProfile) => {
        if (profileRequest.current !== requestId) return;
        setProfile(nextProfile);
        setLoading(false);
      }).catch((error: unknown) => {
        console.error("Could not load the signed-in account profile from Firestore.", error);
        if (profileRequest.current !== requestId) return;
        setProfile(null);
        setLoading(false);
      });
    });

    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    async function signIn(email: string, password: string, studentEmail?: string) {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const requestId = ++profileRequest.current;
      const remoteProfile = await loadProfile(credential.user);
      if (!remoteProfile) {
        throw Object.assign(new Error("No valid Firebase role profile exists for this account."), { code: "profile/missing" });
      }
      const nextProfile = remoteProfile.role === "parent" && studentEmail
        ? { ...remoteProfile, studentEmail: studentEmail.trim().toLowerCase() }
        : remoteProfile;
      if (profileRequest.current === requestId) setProfile(nextProfile);
      await syncAccountDocuments(credential.user, nextProfile);
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
      await syncAccountDocuments(credential.user, nextProfile);
      setProfile(nextProfile);
      return nextProfile.role;
    }

    async function socialSignIn(provider: typeof googleProvider, role?: Role) {
      const credential = await signInWithPopup(auth, provider);
      const requestId = ++profileRequest.current;
      const existingProfile = await loadProfile(credential.user);
      if (!existingProfile && !role) {
        throw Object.assign(new Error("No valid Firebase role profile exists for this account."), { code: "profile/missing" });
      }
      const nextProfile: AuthProfile = existingProfile ?? {
        name: credential.user.displayName || credential.user.email?.split("@")[0] || "Readwise User",
        role: role!,
      };
      if (profileRequest.current === requestId) setProfile(nextProfile);
      await syncAccountDocuments(credential.user, nextProfile);
      return nextProfile.role;
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
