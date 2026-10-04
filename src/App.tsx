import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  Home,
  LineChart,
  Mic,
  Pause,
  Play,
  Plus,
  Shield,
  Sparkles,
  Square,
  Star,
  Target,
  Timer,
  TrendingUp,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AppLayout,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LessonCard,
  LinkButton,
  LogoArtwork,
  Modal,
  ProgressBar,
  SearchBar,
  Select,
  StatCard,
  Table,
  Tabs,
  Toast,
} from "./components/ui";
import { assessments, assignments, classPerformance, currentStudent, lessons, monthlyActivity, recentActivity, trendData } from "./data/mockData";
import { routeForRole, useAuth, useStudentAccountByEmail, useStudentAccounts } from "./auth";
import { analyzeLesson } from "./data/readingAnalysis";
import { transcribeWithWhisper } from "./data/speech";
import { completeUserLesson, lessonsForUser, loadUserLessonProgress, startUserLesson, useUserAssessmentAttempts, useUserLessonProgress, useUserProgressStatsForUsers, userProgressStats } from "./data/userProgress";
import type { NavItem, ReadingMetrics, Role, Student } from "./types";

type RecognitionAlternative = { transcript: string };
type RecognitionResult = ArrayLike<RecognitionAlternative> & { isFinal: boolean };
type RecognitionEvent = { results: ArrayLike<RecognitionResult> };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
type LegacyNavigator = Navigator & {
  webkitGetUserMedia?: (constraints: MediaStreamConstraints, success: (stream: MediaStream) => void, failure: (error: unknown) => void) => void;
  mozGetUserMedia?: (constraints: MediaStreamConstraints, success: (stream: MediaStream) => void, failure: (error: unknown) => void) => void;
};

function requestMicrophone() {
  const modernRequest = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  if (modernRequest) return modernRequest({ audio: true });
  const legacyRequest = (navigator as LegacyNavigator).webkitGetUserMedia ?? (navigator as LegacyNavigator).mozGetUserMedia;
  if (legacyRequest) return new Promise<MediaStream>((resolve, reject) => legacyRequest.call(navigator, { audio: true }, resolve, reject));
  return Promise.reject(new DOMException("Microphone access requires a secure browser context", "SecurityError"));
}

function microphoneErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "Microphone permission was blocked. Allow microphone access for this site and try again.";
  if (name === "SecurityError" || (!window.isSecureContext && !["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname))) return "Microphone access requires HTTPS. Open the app at http://localhost:5174 or use an HTTPS URL, not an embedded preview or LAN HTTP address.";
  return "Could not access the microphone. Check that a microphone is connected and try again.";
}

function normalizedWord(word: string) {
  return word.toLocaleLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
}

function spokenWordProgress(referenceWords: string[], text: string) {
  const heardWords = text.split(/\s+/).map(normalizedWord).filter(Boolean);
  if (!heardWords.length) return 0;

  const expectedWords = referenceWords.map(normalizedWord);
  const rows = expectedWords.length + 1;
  const columns = heardWords.length + 1;
  const costs = Array.from({ length: rows }, () => Array<number>(columns).fill(0));
  for (let row = 0; row < rows; row += 1) costs[row][0] = row;
  for (let column = 0; column < columns; column += 1) costs[0][column] = column;
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitution = expectedWords[row - 1] === heardWords[column - 1] ? 0 : 1;
      costs[row][column] = Math.min(
        costs[row - 1][column] + 1,
        costs[row][column - 1] + 1,
        costs[row - 1][column - 1] + substitution,
      );
    }
  }

  let row = referenceWords.length;
  let column = heardWords.length;
  let lastMatchedWord = 0;
  while (row > 0 && column > 0) {
    if (expectedWords[row - 1] === heardWords[column - 1] && costs[row][column] === costs[row - 1][column - 1]) {
      lastMatchedWord = Math.max(lastMatchedWord, row);
      row -= 1;
      column -= 1;
    } else if (costs[row][column] === costs[row - 1][column - 1] + 1) {
      row -= 1;
      column -= 1;
    } else if (costs[row][column] === costs[row - 1][column] + 1) {
      row -= 1;
    } else {
      column -= 1;
    }
  }

  return lastMatchedWord;
}

const studentNav: NavItem[] = [
  { label: "Dashboard", path: "/student/dashboard", icon: Home },
  { label: "My Lessons", path: "/student/lessons", icon: BookOpen },
  { label: "Reading Results", path: "/student/results", icon: LineChart },
];

const teacherNav: NavItem[] = [
  { label: "Class Overview", path: "/teacher/class-overview", icon: BarChart3 },
  { label: "Students", path: "/teacher/students", icon: Users },
];

const parentNav: NavItem[] = [
  { label: "Dashboard", path: "/parent/dashboard", icon: Home },
];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/student/dashboard" element={<AuthGuard><RoleGuard role="student"><Shell nav={studentNav} subtitle="Grade 4 - Level 3"><StudentDashboard /></Shell></RoleGuard></AuthGuard>} />
      <Route path="/student/lessons" element={<AuthGuard><RoleGuard role="student"><Shell nav={studentNav} subtitle="Grade 4 - Level 3"><LessonsPage /></Shell></RoleGuard></AuthGuard>} />
      <Route path="/student/reading/:lessonId" element={<AuthGuard><RoleGuard role="student"><Shell nav={studentNav} subtitle="Grade 4 - Level 3"><ReadingPage /></Shell></RoleGuard></AuthGuard>} />
      <Route path="/student/results" element={<AuthGuard><RoleGuard role="student"><Shell nav={studentNav} subtitle="Grade 4 - Level 3"><OverallReadingResultsPage /></Shell></RoleGuard></AuthGuard>} />
      <Route path="/student/assessment/:assessmentId" element={<AuthGuard><RoleGuard role="student"><Shell nav={studentNav} subtitle="Grade 4 - Level 3"><AssessmentPage /></Shell></RoleGuard></AuthGuard>} />
      <Route path="/teacher/dashboard" element={<AuthGuard><RoleGuard role="teacher"><Navigate to="/teacher/class-overview" replace /></RoleGuard></AuthGuard>} />
      <Route path="/teacher/students" element={<AuthGuard><RoleGuard role="teacher"><Shell nav={teacherNav} subtitle="Grade 4 Reading"><TeacherStudentsPage /></Shell></RoleGuard></AuthGuard>} />
      <Route path="/teacher/class-overview" element={<AuthGuard><RoleGuard role="teacher"><Shell nav={teacherNav} subtitle="Grade 4 Reading"><TeacherClassOverview /></Shell></RoleGuard></AuthGuard>} />
      <Route path="/teacher/students/:studentId" element={<AuthGuard><RoleGuard role="teacher"><Shell nav={teacherNav} subtitle="Grade 4 Reading"><StudentPerformance /></Shell></RoleGuard></AuthGuard>} />
      <Route path="/parent/dashboard" element={<AuthGuard><RoleGuard role="parent"><Shell nav={parentNav} subtitle="Family reading view"><ParentDashboard /></Shell></RoleGuard></AuthGuard>} />
      <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
    </Routes>
  );
}

function LoadingScreen() {
  return <div className="grid min-h-screen place-items-center bg-surface text-sm font-semibold text-muted">Loading READWISE...</div>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { loading, user, profile } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <div className="grid min-h-screen place-items-center bg-surface p-6 text-center text-sm font-semibold text-danger">Could not load a valid account role from Firebase. Check Firestore permissions and confirm accountProfiles has this user’s UID and role.</div>;
  return <>{children}</>;
}

function RoleGuard({ role, children }: { role: Role; children: React.ReactNode }) {
  const { profile } = useAuth();
  return profile?.role === role ? <>{children}</> : <Navigate to={routeForRole(profile?.role ?? "student")} replace />;
}

function Shell({ nav, subtitle, children }: { nav: NavItem[]; subtitle: string; children: React.ReactNode }) {
  const { profile, user, signOut } = useAuth();
  const displayName = profile?.name || user?.displayName || user?.email?.split("@")[0] || "Readwise User";
  const displayRole = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : "Student";
  return (
    <AppLayout nav={nav} user={{ name: displayName, role: displayRole }} subtitle={subtitle} onSignOut={signOut}>
      {children}
    </AppLayout>
  );
}

function firebaseErrorMessage(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "profile/missing") return "This Google account is not set up in READWISE yet. Select “Create an account,” choose your role, and continue with the same Google account.";
  if (code.includes("auth/invalid-credential")) return "Email or password is incorrect.";
  if (code.includes("auth/email-already-in-use")) return "An account already exists for this email.";
  if (code.includes("auth/popup-closed-by-user")) return "The sign-in popup was closed before finishing.";
  if (code.includes("auth/configuration-not-found")) return "Firebase Authentication is not enabled for this project yet.";
  if (code.includes("auth/unauthorized-domain")) return "This domain is not authorized in Firebase Authentication settings.";
  return "Something went wrong. Please try again.";
}

function AuthVisual() {
  return (
    <div className="relative hidden min-h-screen overflow-hidden bg-navy p-10 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(65,105,245,.45),transparent_34%),radial-gradient(circle_at_78%_70%,rgba(50,166,106,.28),transparent_30%)]" />
      <div className="relative">
        <div className="mb-16"><LogoArtwork className="rounded-md bg-white" /></div>
        <h1 className="mt-4 max-w-xl text-5xl font-extrabold leading-tight tracking-normal">Read Better. Grow Every Day.</h1>
        <p className="mt-5 max-w-lg text-lg leading-8 text-white/75">Build confidence through guided lessons, read-aloud practice, and meaningful progress.</p>
      </div>
    </div>
  );
}

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isConfigured, resetPassword, signIn, signInWithGoogle } = useAuth();
  const [show, setShow] = useState(false);
  const [values, setValues] = useState({ email: "", password: "", studentEmail: "" });
  const [parentLogin, setParentLogin] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const signupNotice = (location.state as { notice?: string } | null)?.notice;
  const [showSignupNotice, setShowSignupNotice] = useState(Boolean(signupNotice));

  useEffect(() => {
    if (!signupNotice) return;
    setShowSignupNotice(true);
    const timeout = window.setTimeout(() => setShowSignupNotice(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [signupNotice]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!values.email.includes("@")) next.email = "Enter a valid email address.";
    if (!values.password) next.password = "Enter your password.";
    if (parentLogin && !values.studentEmail.includes("@")) next.studentEmail = "Enter your student's email address.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const role = await signIn(values.email.trim(), values.password, parentLogin ? values.studentEmail : undefined);
      navigate(routeForRole(role));
    } catch (error) {
      setErrors({ credentials: firebaseErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (!values.email.includes("@")) {
      setErrors({ email: "Enter your email first." });
      return;
    }

    try {
      await resetPassword(values.email.trim());
      setErrors({ notice: "Password reset email sent. Check your inbox." });
    } catch (error) {
      setErrors({ credentials: firebaseErrorMessage(error) });
    }
  }

  async function handleGoogleSignIn() {
    setSubmitting(true);
    try {
      const role = await signInWithGoogle();
      navigate(routeForRole(role));
    } catch (error) {
      setErrors({ credentials: firebaseErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]">
      <AuthVisual />
      <main className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md space-y-5">
          <div className="mb-8 lg:hidden"><LogoArtwork /></div>
          <div>
            <h1 className="text-3xl font-extrabold text-text">Welcome back!</h1>
            <p className="mt-2 text-muted">Sign in to continue your reading practice.</p>
          </div>
          {signupNotice && showSignupNotice ? <p className="rounded-xl bg-[#E8F7EF] p-3 text-sm font-medium text-success" role="status">{signupNotice}</p> : null}
          {!isConfigured ? <p className="rounded-xl bg-[#FFF4DE] p-3 text-sm font-medium text-[#9A6500]">Add your Firebase environment variables before using authentication.</p> : null}
          <Input label="Email" type="email" required value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} error={errors.email} />
          <label className="flex items-center gap-3 text-sm font-semibold text-text"><input type="checkbox" checked={parentLogin} onChange={(e) => setParentLogin(e.target.checked)} className="h-4 w-4" />I am signing in as a parent</label>
          {parentLogin ? <Input label="Student email address" type="email" required value={values.studentEmail} onChange={(e) => setValues({ ...values, studentEmail: e.target.value })} error={errors.studentEmail} placeholder="student@example.com" /> : null}
          <div>
            <Input label="Password" type={show ? "text" : "password"} required value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} error={errors.password} />
            <div className="mt-2 flex justify-between text-sm">
              <button type="button" onClick={() => setShow(!show)} className="font-semibold text-primary">{show ? "Hide" : "Show"} password</button>
              <button type="button" onClick={handleResetPassword} className="font-semibold text-primary">Forgot password?</button>
            </div>
          </div>
          {errors.credentials ? <p className="text-sm font-medium text-danger" role="alert">{errors.credentials}</p> : null}
          {errors.notice ? <p className="text-sm font-medium text-success" role="status">{errors.notice}</p> : null}
          <Button className="w-full" type="submit" loading={submitting} disabled={!isConfigured}>Sign In</Button>
          <Button className="w-full" type="button" variant="outline" disabled={!isConfigured || submitting} onClick={handleGoogleSignIn}>Google</Button>
          <p className="text-center text-sm text-muted">New to READWISE? <a className="font-bold text-primary" href="/signup">Create an account</a></p>
        </form>
      </main>
    </div>
  );
}

function Signup() {
  const navigate = useNavigate();
  const { isConfigured, signInWithGoogle, signOut, signUp } = useAuth();
  const [role, setRole] = useState<Role>("student");
  const [values, setValues] = useState({ name: "", email: "", password: "", confirm: "", studentEmail: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (values.name.trim().length < 2) next.name = "Enter your full name.";
    if (!values.email.includes("@")) next.email = "Enter a valid email.";
    if (values.password.length < 6) next.password = "Use at least 6 characters.";
    if (values.password !== values.confirm) next.confirm = "Passwords must match.";
    if (role === "parent" && !values.studentEmail.includes("@")) next.studentEmail = "Enter your student's email address.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const nextRole = await signUp({ name: values.name.trim(), email: values.email.trim(), password: values.password, role, studentEmail: values.studentEmail.trim().toLowerCase() });
      navigate("/login", { replace: true, state: { notice: `Your ${nextRole} account was created. Please sign in to continue.` } });
    } catch (error) {
      setErrors({ credentials: firebaseErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignUp() {
    setSubmitting(true);
    try {
      const nextRole = await signInWithGoogle(role);
      await signOut();
      navigate("/login", { replace: true, state: { notice: `Your ${nextRole} account was created. Please sign in to continue.` } });
    } catch (error) {
      setErrors({ credentials: firebaseErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]">
      <AuthVisual />
      <main className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md space-y-4">
          <h1 className="text-3xl font-extrabold text-text">Create your account</h1>
          {!isConfigured ? <p className="rounded-xl bg-[#FFF4DE] p-3 text-sm font-medium text-[#9A6500]">Add your Firebase environment variables before creating accounts.</p> : null}
          <Input label="Full name" required value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} error={errors.name} />
          <Input label="Email" type="email" required value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} error={errors.email} />
          {role === "parent" ? <Input label="Student email address" type="email" required value={values.studentEmail} onChange={(e) => setValues({ ...values, studentEmail: e.target.value })} error={errors.studentEmail} placeholder="student@example.com" /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Password" type="password" required value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} error={errors.password} />
            <Input label="Confirm password" type="password" required value={values.confirm} onChange={(e) => setValues({ ...values, confirm: e.target.value })} error={errors.confirm} />
          </div>
          <div>
            <span className="mb-2 block text-sm font-semibold text-text">Role</span>
            <div className="grid grid-cols-3 gap-2">
              {(["student", "teacher", "parent"] as Role[]).map((item) => (
                <button key={item} type="button" onClick={() => setRole(item)} className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${role === item ? "border-primary bg-[#EEF3FF] text-primary" : "border-border text-muted"}`}>
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {errors.credentials ? <p className="text-sm font-medium text-danger" role="alert">{errors.credentials}</p> : null}
          <Button className="w-full" type="submit" loading={submitting} disabled={!isConfigured}>Create Account</Button>
          <Button className="w-full" type="button" variant="outline" disabled={!isConfigured || submitting} onClick={handleGoogleSignUp}>Google</Button>
          <p className="text-center text-sm text-muted">Already have an account? <a className="font-bold text-primary" href="/login">Log in</a></p>
        </form>
      </main>
    </div>
  );
}

function StudentDashboard() {
  const { profile, user } = useAuth();
  useUserLessonProgress(user?.uid);
  const name = profile?.name || user?.displayName || user?.email?.split("@")[0] || "Reader";
  const userLessons = lessonsForUser(user?.uid);
  const stats = userProgressStats(user?.uid);
  const continueLesson = userLessons.find((lesson) => lesson.status === "In Progress") ?? userLessons.find((lesson) => lesson.status === "Not Started") ?? userLessons[0];
  return (
    <div className="space-y-6">
      <PageTitle title={`Hi, ${name}!`} subtitle="Let's continue your reading journey." />
      {!stats.completedCount ? <Card className="border-primary/20 bg-[#F7F9FF]"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><Badge tone="orange">Start here</Badge><h2 className="mt-3 text-xl font-extrabold text-text">Start your first reading activity</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Read a passage aloud so ReadWise can compare your speech with the lesson and show your reading results.</p></div><LinkButton to={`/student/reading/${continueLesson.id}`} className="shrink-0">Begin Reading</LinkButton></div></Card> : null}
      {stats.latest?.assessment?.recommendations.length ? <Card><SectionTitle title="Your next practice" /><div className="grid gap-3 md:grid-cols-3">{stats.latest.assessment.recommendations.map((recommendation) => <div key={recommendation} className="rounded-xl bg-[#F8F9FD] p-4 text-sm leading-6 text-muted">{recommendation}</div>)}</div></Card> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Lessons Completed" value={`${stats.completedCount}/${stats.totalLessons}`} icon={BookOpen} />
        <StatCard label="Average WCPM" value={stats.averageWcpm || "-"} icon={Timer} tone="purple" />
        <StatCard label="Average Accuracy" value={stats.averageAccuracy ? `${stats.averageAccuracy}%` : "-"} icon={Target} tone="green" />
        <StatCard label="Overall Progress" value={`${stats.overallProgress}%`} icon={Sparkles} tone="orange" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="grid gap-6 md:grid-cols-[240px_1fr]">
            <div className="min-h-56 rounded-2xl bg-[#EEF3FF] p-5"><Badge>Continue Learning</Badge><div className="mt-12 text-5xl font-extrabold text-primary">{continueLesson.progress}%</div></div>
            <div className="flex flex-col justify-center">
              <div className="text-sm font-bold text-primary">{continueLesson.category}</div>
              <h2 className="mt-2 text-2xl font-extrabold text-text">{continueLesson.title}</h2>
              <p className="mt-3 text-muted">{continueLesson.level} - {continueLesson.status}</p>
              <ProgressBar value={continueLesson.progress} className="mt-5" />
              <LinkButton to={`/student/reading/${continueLesson.id}`} className="mt-6 w-full sm:w-fit">Continue Reading</LinkButton>
            </div>
          </Card>
          <SectionTitle title="Lesson Set" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{userLessons.filter((lesson) => lesson.id !== continueLesson.id).map((lesson) => <LessonCard key={lesson.id} lesson={lesson} compact />)}</div>
        </div>
        <div className="space-y-4">
          <Widget title="Started Lessons" value={`${stats.inProgressCount}`} progress={(stats.inProgressCount / stats.totalLessons) * 100} />
          <Widget title="Completed Lessons" value={`${stats.completedCount} of ${stats.totalLessons}`} progress={(stats.completedCount / stats.totalLessons) * 100} />
          <Widget title="Overall Progress" value={`${stats.overallProgress}%`} progress={stats.overallProgress} />
        </div>
      </div>
    </div>
  );
}

function LessonsPage() {
  const { user } = useAuth();
  useUserLessonProgress(user?.uid);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("All");
  const [category, setCategory] = useState("All");
  const userLessons = lessonsForUser(user?.uid);
  const filtered = userLessons.filter((lesson) => {
    const matchesQuery = `${lesson.title} ${lesson.description}`.toLowerCase().includes(query.toLowerCase());
    const matchesTab = tab === "All" || lesson.status === tab;
    const matchesCategory = category === "All" || lesson.category === category;
    return matchesQuery && matchesTab && matchesCategory;
  });
  return (
    <div className="space-y-6">
      <PageTitle title="My Lessons" subtitle="Choose a lesson, read aloud, and track your progress." />
      <Card className="space-y-4">
        <SearchBar value={query} onChange={setQuery} placeholder="Search lessons" />
        <div className="grid gap-3 md:grid-cols-4">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}><option>All</option><option>Adventure Story</option><option>Science</option><option>Nature</option><option>Fable</option></Select>
          <Select><option>All Levels</option><option>Level 2</option><option>Level 3</option><option>Level 4</option></Select>
          <Select><option>All Difficulty</option><option>Easy</option><option>Medium</option><option>Challenging</option></Select>
          <Select><option>Any Duration</option><option>Under 6 min</option><option>6-10 min</option></Select>
        </div>
        <Tabs tabs={["All", "In Progress", "Completed", "Not Started"]} active={tab} onChange={setTab} />
      </Card>
      {filtered.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} />)}</div> : <EmptyState title="No lessons found" body="Try changing the search or filters to see more reading options." />}
    </div>
  );
}

function ReadingPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  useUserLessonProgress(user?.uid);
  const lesson = lessonsForUser(user?.uid).find((item) => item.id === lessonId) ?? lessonsForUser(user?.uid)[0];
  const [state, setState] = useState<"idle" | "requesting" | "recording" | "paused" | "stopping" | "analyzing" | "completed">("idle");
  const [seconds, setSeconds] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [hasRecording, setHasRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [metrics, setMetrics] = useState<ReadingMetrics | null>(null);
  const [recognitionStatus, setRecognitionStatus] = useState<"idle" | "listening" | "unavailable" | "processing">("idle");
  const secondsRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const audioUrlRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const recordedMillisecondsBeforePauseRef = useRef(0);
  const recordingStartedAtRef = useRef<number | null>(null);
  const shouldRecognizeRef = useRef(false);
  const recognitionFinishedRef = useRef<Promise<void> | null>(null);
  const resolveRecognitionFinishedRef = useRef<(() => void) | null>(null);
  const words = lesson.passage.join(" ").split(" ");
  const highlighted = spokenWordProgress(words, transcript);

  function updateElapsedTime() {
    const activeMilliseconds = recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : 0;
    const totalMilliseconds = recordedMillisecondsBeforePauseRef.current + activeMilliseconds;
    const next = totalMilliseconds > 0 ? Math.ceil(totalMilliseconds / 1000) : 0;
    secondsRef.current = next;
    setSeconds(next);
  }

  function startElapsedTimer() {
    recordingStartedAtRef.current = Date.now();
    updateElapsedTime();
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(updateElapsedTime, 250);
  }

  function pauseElapsedTimer() {
    updateElapsedTime();
    if (recordingStartedAtRef.current !== null) {
      recordedMillisecondsBeforePauseRef.current += Date.now() - recordingStartedAtRef.current;
    }
    recordingStartedAtRef.current = null;
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    shouldRecognizeRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch { /* Recognition may already be stopped. */ }
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    window.speechSynthesis?.cancel();
  }, []);

  function readAloud() {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setRecordingError("Read-aloud playback is not supported in this browser. You can still read the passage yourself.");
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(lesson.passage.join(" "));
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  function startBrowserRecognition() {
    const Recognition = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!Recognition) {
      setRecognitionStatus("unavailable");
      return;
    }
    try {
      const transcriptBeforeSession = transcriptRef.current.trim();
      let resolveFinished: (() => void) | null = null;
      recognitionFinishedRef.current = new Promise<void>((resolve) => { resolveFinished = resolve; });
      const resolveThisRecognition = () => {
        resolveFinished?.();
        if (resolveRecognitionFinishedRef.current === resolveThisRecognition) resolveRecognitionFinishedRef.current = null;
      };
      resolveRecognitionFinishedRef.current = resolveThisRecognition;
      const recognition = new Recognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        const finalParts: string[] = [];
        const interimParts: string[] = [];
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          const alternative = result?.[0];
          if (!alternative?.transcript) continue;
          if (result.isFinal) finalParts.push(alternative.transcript.trim());
          else interimParts.push(alternative.transcript.trim());
        }
        transcriptRef.current = [transcriptBeforeSession, finalParts.join(" ")].filter(Boolean).join(" ").trim();
        setTranscript([transcriptRef.current, interimParts.join(" ")].filter(Boolean).join(" "));
      };
      recognition.onerror = () => setRecognitionStatus("unavailable");
      recognition.onend = () => {
        resolveThisRecognition();
        if (shouldRecognizeRef.current && recorderRef.current?.state === "recording") {
          window.setTimeout(() => {
            if (shouldRecognizeRef.current && recorderRef.current?.state === "recording") startBrowserRecognition();
          }, 200);
          return;
        }
        setRecognitionStatus(transcriptRef.current ? "idle" : "unavailable");
      };
      recognition.start();
      setRecognitionStatus("listening");
    } catch {
      resolveRecognitionFinishedRef.current?.();
      setRecognitionStatus("unavailable");
    }
  }

  async function start() {
    if (state === "requesting" || state === "recording" || state === "paused" || state === "stopping" || state === "analyzing") return;
    setRecordingError("");
    setState("requesting");
    setSeconds(0);
    secondsRef.current = 0;
    recordedMillisecondsBeforePauseRef.current = 0;
    recordingStartedAtRef.current = null;
    setHasRecording(false);
    setAudioUrl("");
    setTranscript("");
    setMetrics(null);
    transcriptRef.current = "";
    setRecognitionStatus("idle");
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    if (typeof MediaRecorder === "undefined") {
      setState("idle");
      setRecordingError("This browser does not support audio recording. Open the app in a current Chrome, Edge, or Firefox browser.");
      return;
    }
    try {
      const stream = await requestMicrophone();
      streamRef.current = stream;
      const supportedMimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => typeof MediaRecorder.isTypeSupported !== "function" || MediaRecorder.isTypeSupported(type));
      const recorder = supportedMimeType ? new MediaRecorder(stream, { mimeType: supportedMimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) {
          if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = URL.createObjectURL(blob);
          setAudioUrl(audioUrlRef.current);
          setHasRecording(true);
          setState("analyzing");
          setRecognitionStatus("processing");
          await Promise.race([
            recognitionFinishedRef.current ?? Promise.resolve(),
            new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
          ]);
          let finalTranscript = transcriptRef.current.trim();
          let source: ReadingMetrics["source"] = finalTranscript ? "browser" : "manual";
          const whisper = await transcribeWithWhisper(blob);
          if (whisper?.text.trim()) {
            finalTranscript = whisper.text.trim();
            source = "whisper";
          }
          setTranscript(finalTranscript);
          if (finalTranscript) {
            setMetrics(analyzeLesson(lesson, finalTranscript, Math.max(secondsRef.current, 1), source));
            setRecognitionStatus("idle");
          } else {
            setMetrics(null);
            setRecognitionStatus("unavailable");
            setRecordingError("Your audio is ready to review, but no speech was detected for assessment. Record again after checking the preview.");
          }
          setState("completed");
        } else {
          setHasRecording(false);
          setState("idle");
          setRecordingError("No audio was captured. Please try recording again.");
        }
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
      };
      recorder.onerror = () => {
        setState("idle");
        setHasRecording(false);
        setRecordingError("The recording stopped unexpectedly. Please try again.");
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorder.start(1000);
      void startUserLesson(user?.uid, lesson.id);
      setState("recording");
      shouldRecognizeRef.current = true;
      startElapsedTimer();
      startBrowserRecognition();
    } catch (error) {
      setState("idle");
      setRecordingError(microphoneErrorMessage(error));
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function togglePause() {
    const recorder = recorderRef.current;
    if (!recorder || state === "stopping") return;
    if (state === "recording" && recorder.state === "recording") {
      recorder.pause();
      pauseElapsedTimer();
      shouldRecognizeRef.current = false;
      try { recognitionRef.current?.stop(); } catch { /* Recognition may already be stopped. */ }
      setState("paused");
    } else if (state === "paused" && recorder.state === "paused") {
      recorder.resume();
      startElapsedTimer();
      shouldRecognizeRef.current = true;
      startBrowserRecognition();
      setState("recording");
    }
  }

  function stop() {
    const recorder = recorderRef.current;
    if (!recorder || (recorder.state !== "recording" && recorder.state !== "paused")) return;
    setState("stopping");
    pauseElapsedTimer();
    shouldRecognizeRef.current = false;
    setRecognitionStatus((status) => status === "listening" ? "processing" : status);
    try { recognitionRef.current?.stop(); } catch { /* Recognition may already be stopped. */ }
    recorder.stop();
  }

  async function finish() {
    if (submitting) return;
    if (!hasRecording || !audioUrl) {
      setRecordingError("Record your reading and listen to the preview before submitting it.");
      return;
    }
    if (!metrics || !transcript.trim()) {
      setRecordingError("A speech transcript is needed before results can be submitted. Please record the passage again.");
      return;
    }
    setRecordingError("");
    setSubmitting(true);
    try {
      const completed = await completeUserLesson(user?.uid, lesson, Math.max(secondsRef.current, 1), metrics, "lesson");
      if (!completed) {
        setRecordingError("We could not save your assessment to your account. Check your connection and try again.");
        return;
      }
      navigate(`/student/assessment/${lesson.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  const statusLabel = state === "idle" ? "Ready to read" : state === "requesting" ? "Requesting microphone" : state === "recording" ? "Recording your reading" : state === "paused" ? "Recording paused" : state === "stopping" ? "Saving recording" : state === "analyzing" ? "Analyzing reading" : "Recording ready";
  const helperLabel = state === "idle" ? "Start when you are ready to read the passage." : state === "requesting" ? "Allow microphone access in your browser." : state === "recording" ? "Read the passage aloud clearly." : state === "paused" ? "Resume when you are ready, or stop to preview it." : state === "stopping" ? "Preparing your audio preview..." : state === "analyzing" ? "Checking your transcript and reading metrics..." : "Listen to your recording before submitting.";

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div><Badge tone="purple">{lesson.category}</Badge><h1 className="mt-2 text-2xl font-extrabold text-text">{lesson.title}</h1><p className="text-sm font-medium text-muted">{lesson.level} - Reading progress {lesson.progress}%</p></div>
        <div className="flex items-center gap-3"><Badge tone="purple"><Clock className="mr-1 h-3 w-3" /> {seconds || 0}s</Badge><Button variant="outline" onClick={() => navigate("/student/lessons")}>Exit</Button></div>
      </Card>
      <Card className="p-6 md:p-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><Badge>{statusLabel}</Badge><div className="flex items-center gap-3"><span className="text-sm font-semibold text-muted">{seconds}s</span><ProgressBar value={state === "idle" ? lesson.progress : Math.round((highlighted / Math.max(words.length, 1)) * 100)} className="w-36" /></div></div>
        <div className="mb-6 rounded-2xl border border-[#DCE5FF] bg-[#F7F9FF] p-5">
          <div className="flex items-start gap-3"><BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><h2 className="font-bold text-text">Reading lesson</h2><p className="mt-1 text-sm leading-6 text-muted">{lesson.description}</p><p className="mt-3 text-sm font-semibold text-primary">Read every sentence at a comfortable pace. You can hear a model reading first.</p></div></div>
        </div>
        <div className="mb-6 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={readAloud}><span>{speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</span>{speaking ? "Stop reading aloud" : "Read aloud"}</Button>
          <span className="self-center text-sm text-muted">Listen once, then read the lesson yourself.</span>
        </div>
        <article className="text-xl leading-10 text-text md:text-2xl md:leading-[3.25rem]">
          {lesson.passage.map((paragraph, paragraphIndex) => {
            const paragraphStart = lesson.passage.slice(0, paragraphIndex).reduce((count, item) => count + item.split(" ").length, 0);
            return <p key={`${paragraph.slice(0, 18)}-${paragraphIndex}`} className="mb-6 last:mb-0">{paragraph.split(" ").map((word, wordIndex) => <span key={`${word}-${wordIndex}`} className={paragraphStart + wordIndex < highlighted ? "rounded bg-[#FFF4DE] px-1 font-semibold" : ""}>{word} </span>)}</p>;
          })}
        </article>
      </Card>
      <Card className="sticky bottom-4 p-5">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <div className="flex items-center gap-3">
            <button onClick={state === "idle" || state === "completed" ? start : togglePause} disabled={state === "requesting" || state === "stopping" || state === "analyzing"} className="grid h-20 w-20 place-items-center rounded-full bg-primary text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-60" aria-label={state === "recording" ? "Pause recording" : state === "paused" ? "Resume recording" : "Start recording"}>
              {state === "recording" ? <Pause className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
            </button>
            <div><div className="font-bold text-text">{statusLabel}</div><div className="text-sm text-muted">{helperLabel}</div></div>
          </div>
          <div className="flex w-full items-center gap-2 md:w-auto">
            <Button variant="outline" onClick={togglePause} disabled={state !== "recording" && state !== "paused"}><Pause className="h-4 w-4" />{state === "paused" ? "Resume" : "Pause"}</Button>
            <Button variant="secondary" onClick={stop} disabled={state !== "recording" && state !== "paused"}><Square className="h-4 w-4" />Stop</Button>
            <Button onClick={finish} loading={submitting} disabled={state !== "completed" || !hasRecording || !metrics}>{submitting ? "Saving assessment..." : "Finish & Submit"}</Button>
          </div>
        </div>
        {submitting ? <p className="mt-4 text-sm font-medium text-primary" role="status" aria-live="polite">Saving your assessment to your account. This may take a moment.</p> : null}
        {recordingError ? <p className="mt-4 text-sm font-medium text-warning" role="status">{recordingError}</p> : null}
        {audioUrl ? <div className="mt-5 rounded-xl border border-[#DCE5FF] bg-[#F7F9FF] p-4"><div className="mb-2 flex items-center justify-between gap-3"><div><p className="font-bold text-text">Listen to your recording</p><p className="text-sm text-muted">Check your reading before you submit. You can record again if needed.</p></div><Badge tone="green">Ready</Badge></div><audio className="w-full" controls src={audioUrl}>Your browser cannot play this recording.</audio>{recognitionStatus === "processing" || state === "analyzing" ? <p className="mt-3 text-sm font-semibold text-primary">Speech analysis is still processing...</p> : null}{transcript ? <div className="mt-4 rounded-xl bg-white p-3 text-sm leading-6 text-muted"><span className="font-bold text-text">Transcript ({metrics?.source === "whisper" ? "Whisper AI" : "browser speech recognition"}):</span> {transcript}</div> : <p className="mt-3 text-sm text-warning">Speech-to-text was unavailable. Check the microphone and record again to generate reading results.</p>}</div> : null}
      </Card>
    </div>
  );
}

function AssessmentPage() {
  const { profile, user } = useAuth();
  const { available, syncing } = useUserLessonProgress(user?.uid);
  const { attempts, available: attemptsAvailable } = useUserAssessmentAttempts(user?.uid);
  const { assessmentId } = useParams();
  const name = profile?.name || user?.displayName || user?.email?.split("@")[0] || "Reader";
  const matchingProgress = loadMatchingAssessment(user?.uid, assessmentId);
  const assessment = matchingProgress?.assessment;
  const previousAssessment = matchingProgress
    ? attempts.filter((attempt) => attempt.lessonId === matchingProgress.lessonId && attempt.assessment.id !== assessment?.id)
      .sort((left, right) => right.attemptedAt.localeCompare(left.attemptedAt))[0]?.assessment
    : undefined;
  if (!assessment) {
    return <EmptyState title="No result for this lesson yet" body="Complete this reading lesson to see its assessment results here." />;
  }
  return (
    <div className="space-y-6">
      <PageTitle title={assessment.kind === "initial" ? `${name}'s starting reading profile` : `Great job, ${name}!`} subtitle={assessment.kind === "initial" ? "This baseline will personalize your next lessons." : "Your reading result is ready."} />
      {syncing ? <p className="rounded-xl bg-[#FFF4DE] p-3 text-sm font-medium text-[#805500]" role="status" aria-live="polite">Your results are ready. Saving your assessment to your account...</p> : null}
      {!available ? <p className="rounded-xl bg-[#FFF4DE] p-3 text-sm font-medium text-[#805500]" role="status">Your result is shown, but we could not sync it to your account. Check your connection and try again.</p> : null}
      {!attemptsAvailable ? <p className="rounded-xl bg-[#FFF4DE] p-3 text-sm font-medium text-[#805500]" role="status">Previous reading attempts could not be loaded. This result is still available.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Word match accuracy" value={`${assessment.accuracy}%`} icon={Target} />
        <StatCard label="Words correct per minute" value={assessment.wcpm} icon={Timer} tone="green" />
      </div>
      <Card>
        <SectionTitle title="This lesson's reading results" />
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={[
            ...(previousAssessment ? [{ name: "Previous", accuracy: previousAssessment.accuracy, wcpm: previousAssessment.wcpm }] : []),
            { name: "Current", accuracy: assessment.accuracy, wcpm: assessment.wcpm },
          ]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4E7F0" />
            <XAxis dataKey="name" />
            <YAxis yAxisId="accuracy" domain={[0, 100]} />
            <YAxis yAxisId="wcpm" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="accuracy" dataKey="accuracy" name="Accuracy (%)" fill="#4169F5" radius={8} />
            <Bar yAxisId="wcpm" dataKey="wcpm" name="WCPM" fill="#32A66A" radius={8} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
      <Card className="space-y-3">
          <h2 className="text-xl font-bold">Assessment Summary</h2>
          {["Lesson", assessment.lesson, "Reading level", assessment.readingLevel, "Date", assessment.date, "Reading duration", assessment.duration, "Words read", String(assessment.wordsRead), "Analysis", assessment.source === "whisper" ? "Whisper AI" : assessment.source === "browser" ? "Browser speech recognition" : "Audio only"].map((item, index) => index % 2 === 0 ? <div key={`${item}-${index}`} className="pt-2 text-xs font-bold uppercase text-muted">{item}</div> : <div key={`${item}-${index}`} className="text-base font-semibold text-text">{item}</div>)}
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        <Feedback title="What You Did Well" tone="green" items={[`${assessment.accuracy}% of reference words matched.`, `${assessment.wcpm} words correct per minute.`, assessment.errors.length ? `${assessment.errors.length} reading issue${assessment.errors.length === 1 ? "" : "s"} identified for practice.` : "No reading errors were identified."]} />
        <Feedback title="Personalized Practice" tone="orange" items={assessment.recommendations} />
      </div>
      <Card>
        <SectionTitle title="Reading error analysis" />
        {assessment.errors.length ? <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="text-muted"><th className="px-3 py-2">Type</th><th className="px-3 py-2">Expected</th><th className="px-3 py-2">Heard</th></tr></thead><tbody>{assessment.errors.map((error, index) => <tr key={`${error.type}-${index}`} className="border-t border-border"><td className="px-3 py-3 font-semibold capitalize text-text">{error.type}</td><td className="px-3 py-3 text-muted">{error.expected ?? "-"}</td><td className="px-3 py-3 text-muted">{error.heard ?? "-"}</td></tr>)}</tbody></table></div> : <p className="text-sm text-success">No skipped, inserted, repeated, or mispronounced words were detected.</p>}
        {assessment.transcript ? <p className="mt-4 rounded-xl bg-[#F8F9FD] p-4 text-sm leading-6 text-muted"><span className="font-bold text-text">Transcript:</span> {assessment.transcript}</p> : null}
      </Card>
      <div className="flex flex-wrap gap-3"><LinkButton to="/student/lessons">Continue Learning</LinkButton></div>
    </div>
  );
}

function OverallReadingResultsPage() {
  const { user } = useAuth();
  const { available } = useUserLessonProgress(user?.uid);
  const stats = userProgressStats(user?.uid);
  const difficultyOrder = { Easy: 0, Medium: 1, Challenging: 2 };
  const lessonNumbers = [...lessons]
    .sort((left, right) => difficultyOrder[left.difficulty] - difficultyOrder[right.difficulty] || lessons.indexOf(left) - lessons.indexOf(right))
    .reduce((numbers, lesson, index) => numbers.set(lesson.id, index + 1), new Map<string, number>());
  const results = loadUserLessonProgress(user?.uid).items
    .filter((item) => item.assessment)
    .map((item) => {
      const assessment = item.assessment!;
      const lesson = lessons.find((entry) => entry.id === item.lessonId);
      return {
        assessment,
        lessonNumber: lessonNumbers.get(item.lessonId) ?? Number.MAX_SAFE_INTEGER,
        lessonTitle: lesson?.title ?? assessment.lesson,
        difficulty: lesson?.difficulty ?? "Unknown",
      };
    })
    .sort((left, right) => left.lessonNumber - right.lessonNumber || left.lessonTitle.localeCompare(right.lessonTitle));

  return (
    <div className="space-y-6">
      <PageTitle title="Reading Results" subtitle="See your overall reading performance across lessons." />
      {!available ? <p className="rounded-xl bg-[#FFF4DE] p-3 text-sm font-medium text-[#805500]" role="status">Some assessment data could not be loaded. Check your connection and Firestore permissions.</p> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Lessons Assessed" value={results.length} icon={BookOpen} />
        <StatCard label="Average Accuracy" value={results.length ? `${stats.averageAccuracy}%` : "-"} icon={Target} tone="green" />
        <StatCard label="Average WCPM" value={results.length ? stats.averageWcpm : "-"} icon={Timer} tone="purple" />
      </div>
      {results.length > 1 ? (
        <>
        <p className="text-sm text-muted">Lesson numbers follow difficulty order: Easy, Medium, then Challenging. Hover over a graph point or bar to see the lesson title.</p>
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <SectionTitle title="Accuracy across lessons" />
            <ResponsiveContainer width="100%" height={280}>
              <ReLineChart data={results.map((result) => ({ name: `Lesson ${result.lessonNumber}`, title: result.lessonTitle, difficulty: result.difficulty, accuracy: result.assessment.accuracy }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7F0" /><XAxis dataKey="name" /><YAxis domain={[0, 100]} /><Tooltip labelFormatter={(_label, payload) => payload[0]?.payload ? `${payload[0].payload.title} (${payload[0].payload.difficulty})` : ""} /><Line dataKey="accuracy" name="Accuracy (%)" stroke="#4169F5" strokeWidth={3} dot={{ r: 4 }} />
              </ReLineChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <SectionTitle title="WCPM across lessons" />
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={results.map((result) => ({ name: `Lesson ${result.lessonNumber}`, title: result.lessonTitle, difficulty: result.difficulty, wcpm: result.assessment.wcpm }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7F0" /><XAxis dataKey="name" /><YAxis /><Tooltip labelFormatter={(_label, payload) => payload[0]?.payload ? `${payload[0].payload.title} (${payload[0].payload.difficulty})` : ""} /><Bar dataKey="wcpm" name="WCPM" fill="#32A66A" radius={8} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
        </>
      ) : <EmptyState title={results.length ? "Read another lesson to see your graphs" : "No reading results yet"} body={results.length ? "Overall graphs appear after you have assessment results for at least two lessons." : "Complete a reading lesson and its assessment will appear here."} />}
    </div>
  );
}

function loadMatchingAssessment(userId?: string | null, assessmentId?: string) {
  const lessonId = assessmentId?.startsWith("a-") ? assessmentId.slice(2) : assessmentId;
  return loadUserLessonProgress(userId).items.find((item) => item.lessonId === lessonId);
}

function ProgressPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Progress & Performance" subtitle="Track reading growth across accuracy, pace, and consistency." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Reading Level" value="Level 3" icon={BookOpen} />
        <StatCard label="Lessons" value="24" icon={CheckCircle2} tone="green" />
        <StatCard label="Reading Time" value="12h" icon={Clock} tone="orange" />
        <StatCard label="Avg WCPM" value="118" icon={Timer} tone="purple" />
        <StatCard label="Avg Accuracy" value="92%" icon={Target} tone="green" />
        <StatCard label="Overall" value="68%" icon={TrendingUp} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2"><TrendChart title="Accuracy over time" dataKey="accuracy" color="#4169F5" /><TrendChart title="WCPM over time" dataKey="wcpm" color="#6C4CE8" /><TrendChart title="Lessons completed" dataKey="lessons" color="#32A66A" type="bar" /><TrendChart title="Weekly reading activity" dataKey="activity" color="#F5A623" type="bar" /></div>
      <Card><SectionTitle title="Monthly Activity" /><div className="grid grid-cols-7 gap-2 sm:grid-cols-14">{monthlyActivity.map((value, index) => <div key={index} className="h-10 rounded-lg bg-[#EEF3FF]" title={`${value} minutes`}><div className="h-full rounded-lg bg-primary" style={{ opacity: value / 100 }} /></div>)}</div></Card>
    </div>
  );
}

function useTeacherStudents() {
  const { accounts, available: directoryAvailable, loading: directoryLoading } = useStudentAccounts();
  const { stats, available: progressAvailable } = useUserProgressStatsForUsers(accounts.map((account) => account.uid));
  const students = accounts.map((account, index) => studentRecord(account.uid, account.name, account.email, stats[index]));
  return {
    students,
    directoryAvailable,
    directoryLoading,
    progressAvailable,
    activeStudents: students.filter((student) => student.lessonsCompleted > 0).length,
  };
}

function TeacherStudentsPage() {
  const { students, directoryAvailable, directoryLoading, progressAvailable } = useTeacherStudents();
  return (
    <div className="space-y-6">
      <PageTitle title="Students" subtitle="View student reading performance and lesson progress." />
      {!directoryAvailable ? <p className="rounded-xl bg-[#FFF4DE] p-3 text-sm font-medium text-[#805500]" role="status">Student accounts could not be loaded. Check your connection and Firestore permissions.</p> : null}
      {!progressAvailable ? <p className="rounded-xl bg-[#FFF4DE] p-3 text-sm font-medium text-[#805500]" role="status">Student accounts loaded, but some learning data could not be read. Check the published Firestore rules.</p> : null}
      <Card><SectionTitle title="Student Directory" />{directoryLoading ? <p className="py-4 text-sm text-muted">Loading student accounts...</p> : students.length ? <Table headers={["Student", "Email", "Accuracy", "WCPM", "Progress", "Status", "Action"]} rows={students.map((student) => [<div className="flex items-center gap-3"><Avatar name={student.name} /><span className="font-bold">{student.name}</span></div>, student.email, `${student.accuracy}%`, student.wcpm || "-", <ProgressBar value={student.progress} />, <Badge tone={student.status === "On Track" ? "green" : student.status === "Needs Practice" ? "orange" : "gray"}>{student.status}</Badge>, <LinkButton to={`/teacher/students/${student.id}`} variant="outline">View</LinkButton>])} /> : <EmptyState title="No students registered" body="Student accounts will appear here after they sign up." />}</Card>
    </div>
  );
}

function TeacherClassOverview() {
  const { students, activeStudents, directoryAvailable, directoryLoading, progressAvailable } = useTeacherStudents();
  const totalLessonsCompleted = students.reduce((total, student) => total + student.lessonsCompleted, 0);
  const averageProgress = students.length ? Math.round(students.reduce((total, student) => total + student.progress, 0) / students.length) : 0;
  return (
    <div className="space-y-6">
      <PageTitle title="Class Overview" subtitle="Review class-wide reading outcomes and student progress." />
      {!directoryAvailable ? <p className="rounded-xl bg-[#FFF4DE] p-3 text-sm font-medium text-[#805500]" role="status">Student accounts could not be loaded. Check your connection and Firestore permissions.</p> : null}
      {!progressAvailable ? <p className="rounded-xl bg-[#FFF4DE] p-3 text-sm font-medium text-[#805500]" role="status">Student accounts loaded, but some learning data could not be read. Check the published Firestore rules.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Students" value={students.length} icon={Users} /><StatCard label="Active Readers" value={activeStudents} icon={Activity} tone="green" /><StatCard label="Lessons Completed" value={totalLessonsCompleted} icon={BookOpen} tone="orange" /><StatCard label="Average Progress" value={`${averageProgress}%`} icon={TrendingUp} tone="purple" /></div>
      <div className="grid gap-6 xl:grid-cols-2">
        <TrendChart title="Accuracy by student" dataKey="accuracy" color="#4169F5" source={students.map((student) => ({ name: student.name, accuracy: student.accuracy }))} />
        <TrendChart title="WCPM by student" dataKey="wcpm" color="#6C4CE8" type="bar" source={students.map((student) => ({ name: student.name, wcpm: student.wcpm }))} />
      </div>
      <Card><SectionTitle title="Class progress" /><p className="text-sm text-muted">Progress reflects each student's completed lessons.</p>{directoryLoading ? <p className="py-4 text-sm text-muted">Loading student accounts...</p> : students.length ? <div className="mt-4 space-y-4">{students.map((student) => <div key={student.id} className="grid gap-2 sm:grid-cols-[minmax(140px,1fr)_2fr_auto] sm:items-center"><span className="font-semibold text-text">{student.name}</span><ProgressBar value={student.progress} /><span className="text-sm font-semibold text-muted">{student.progress}% · {student.lessonsCompleted} lessons</span></div>)}</div> : <EmptyState title="No class data yet" body="Student progress will appear here after students register and start lessons." />}</Card>
    </div>
  );
}

function StudentPerformance() {
  const { studentId } = useParams();
  const { accounts, loading, available } = useStudentAccounts();
  const account = accounts.find((item) => item.uid === studentId);
  const { stats, available: progressAvailable } = useUserProgressStatsForUsers(account ? [account.uid] : []);
  const student = account ? studentRecord(account.uid, account.name, account.email, stats[0]) : null;
  const studentLessonProgress = student
    ? loadUserLessonProgress(student.id).items
      .filter((item) => item.status !== "Not Started" || item.startedAt)
      .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""))
    : [];
  if (loading) return <LoadingScreen />;
  if (!available) return <EmptyState title="Student data unavailable" body="We could not load student accounts. Check your connection and Firestore permissions." />;
  if (!student) return <EmptyState title="Student not found" body="This student account is no longer available." />;
  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-5"><Avatar name={student.name} size="lg" /><div><h1 className="text-3xl font-extrabold">{student.name}</h1><p className="text-muted">{student.grade} - {student.className} - {student.level}</p></div><Badge tone="green">{student.status}</Badge></Card>
      {!progressAvailable ? <p className="rounded-xl bg-[#FFF4DE] p-3 text-sm font-medium text-[#805500]" role="status">Student learning data could not be read. Check the published Firestore rules.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Accuracy" value={`${student.accuracy}%`} icon={Target} /><StatCard label="WCPM" value={student.wcpm} icon={Timer} tone="purple" /><StatCard label="Fluency" value={`${student.fluency}%`} icon={Activity} tone="green" /><StatCard label="Lessons" value={student.lessonsCompleted} icon={BookOpen} tone="orange" /></div>
      <Card><SectionTitle title="Lesson Progress" />{studentLessonProgress.length ? <Table headers={["Lesson", "Status", "Progress", "Accuracy", "WCPM", "Started"]} rows={studentLessonProgress.map((item) => [item.assessment?.lesson ?? lessons.find((lesson) => lesson.id === item.lessonId)?.title ?? item.lessonId, <Badge tone={item.status === "Completed" ? "green" : "orange"}>{item.status}</Badge>, <ProgressBar value={item.progress} />, item.assessment ? `${item.assessment.accuracy}%` : "-", item.assessment?.wcpm ?? "-", item.startedAt ? new Date(item.startedAt).toLocaleDateString() : "-"])} /> : <EmptyState title="No lessons started" body="The student's lesson progress will appear here after they start a lesson." />}</Card>
    </div>
  );
}

function AssignmentsPage() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");
  function create(event: FormEvent) {
    event.preventDefault();
    setOpen(false);
    setToast("Assignment created");
    setTimeout(() => setToast(""), 2200);
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><PageTitle title="Assignment Management" subtitle="Create and monitor reading assignments." /><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add Assignment</Button></div>
      <Card><Table headers={["Assignment", "Lesson", "Class", "Due Date", "Completion", "Status", "Actions"]} rows={assignments.map((a) => [<span className="font-bold">{a.title}</span>, a.lesson, a.className, a.dueDate, <ProgressBar value={a.completion} />, <Badge tone={a.status === "Active" ? "green" : a.status === "Due Soon" ? "orange" : "gray"}>{a.status}</Badge>, <div className="flex gap-2"><Button variant="outline">View</Button><Button variant="secondary">Edit</Button><Button variant="danger">Delete</Button></div>])} /></Card>
      <Modal open={open} title="Create Assignment" onClose={() => setOpen(false)}><form onSubmit={create} className="space-y-4"><Input label="Assignment title" required /><Input label="Description" required /><Select label="Lesson">{lessons.map((l) => <option key={l.id}>{l.title}</option>)}</Select><Select label="Class"><option>Grade 4A</option><option>Grade 4B</option></Select><Input label="Due date" type="date" required /><Input label="Instructions" required /><Button type="submit" className="w-full">Create Assignment</Button></form></Modal>
      <Toast message={toast} />
    </div>
  );
}

function ParentDashboard() {
  const { profile, user } = useAuth();
  const name = profile?.name || user?.displayName || user?.email?.split("@")[0] || "there";
  const { account: linkedAccount, available: directoryAvailable, loading: directoryLoading } = useStudentAccountByEmail(profile?.studentEmail);
  const { items: lessonProgress, available: progressAvailable, loading: progressLoading } = useUserLessonProgress(linkedAccount?.uid);
  const linkedStats = userProgressStats(linkedAccount?.uid);
  const latestAssessment = linkedStats.latest?.assessment;
  if (!profile?.studentEmail) {
    return <EmptyState title="Student connection needed" body="Sign in again and enter your student's email address to view their reading progress." />;
  }
  if (directoryLoading) return <LoadingScreen />;
  if (!directoryAvailable) return <EmptyState title="Student data unavailable" body="We could not look up the linked student account. Check your connection and Firestore permissions." />;
  if (!linkedAccount) {
    return <EmptyState title="Student account not found" body={`No student account was found for ${profile.studentEmail}. Check the email address and try again.`} />;
  }
  return (
    <div className="space-y-6">
      <PageTitle title={`Welcome back, ${name}!`} subtitle="Your linked student's reading progress is easy to follow." />
      <Card className="grid gap-5 md:grid-cols-[auto_1fr_auto]"><Avatar name={linkedAccount.name} size="lg" /><div><h2 className="text-2xl font-extrabold">{linkedAccount.name}</h2><p className="text-muted">Reading learner</p><ProgressBar value={linkedStats.overallProgress} className="mt-4" /></div><div className="grid grid-cols-2 gap-3 text-center"><Metric label="Accuracy" value={linkedStats.averageAccuracy ? `${linkedStats.averageAccuracy}%` : "-"} /><Metric label="WCPM" value={linkedStats.averageWcpm ? String(linkedStats.averageWcpm) : "-"} /></div></Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Lessons Completed" value={`${linkedStats.completedCount}/${linkedStats.totalLessons}`} icon={BookOpen} /><StatCard label="Reading Time" value={latestAssessment?.duration ?? "-"} icon={Clock} tone="orange" /><StatCard label="Current Progress" value={`${linkedStats.overallProgress}%`} icon={Sparkles} tone="green" /><StatCard label="Recent Assessment" value={latestAssessment ? `${latestAssessment.overall}%` : "-"} icon={CheckCircle2} tone="purple" /></div>
      <StudentLessonHistory items={lessonProgress} available={progressAvailable} loading={progressLoading} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]"><TrendChart title="Reading Progress" dataKey="accuracy" color="#4169F5" /><Card><SectionTitle title="How You Can Help" /><div className="space-y-3">{["Read together for 10 minutes each evening.", "Practice difficult words before a lesson.", "Build vocabulary by asking your student to explain new words.", "Encourage daily reading without rushing pace."].map((item) => <div key={item} className="rounded-xl bg-[#F8F9FD] p-4 text-sm font-medium text-muted">{item}</div>)}</div></Card></div>
    </div>
  );
}

function StudentLessonHistory({ items, available, loading }: { items: ReturnType<typeof loadUserLessonProgress>["items"]; available: boolean; loading: boolean }) {
  const assessments = items.filter((item) => item.assessment).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  return <Card id="learning-history"><SectionTitle title="Learning History" />{!available ? <p className="mb-4 rounded-xl bg-[#FFF4DE] p-3 text-sm font-medium text-[#805500]" role="status">Student learning data could not be loaded. Check your connection and Firestore permissions.</p> : null}{loading ? <p className="py-4 text-sm text-muted">Loading learning history...</p> : assessments.length ? <Table headers={["Lesson", "Status", "Accuracy", "WCPM", "Completed"]} rows={assessments.map(({ assessment, status, completedAt }) => [assessment!.lesson, status, `${assessment!.accuracy}%`, assessment!.wcpm, completedAt ? new Date(completedAt).toLocaleDateString() : "In progress"])} /> : <EmptyState title="No lesson data yet" body="Completed lessons and assessment results will appear here." />}</Card>;
}

function studentRecord(userId: string, name: string, email: string, stats = userProgressStats(userId)): Student & { email: string } {
  return {
    id: userId,
    name,
    email,
    grade: "Student",
    className: "",
    level: "Reading learner",
    accuracy: stats.averageAccuracy,
    wcpm: stats.averageWcpm,
    fluency: stats.averageAccuracy,
    progress: stats.overallProgress,
    lessonsCompleted: stats.completedCount,
    status: stats.completedCount ? "On Track" : stats.inProgressCount ? "Improving" : "Not Started",
  };
}

function AdminDashboard() {
  return (
    <div className="space-y-6">
      <PageTitle title="Admin Dashboard" subtitle="Platform usage, learning activity, and operations." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total Students" value="1,284" icon={Users} /><StatCard label="Total Teachers" value="86" icon={GraduationCap} tone="purple" /><StatCard label="Total Parents" value="1,109" icon={Users} tone="green" /><StatCard label="Active Users" value="742" icon={Activity} tone="orange" /><StatCard label="Total Lessons" value="148" icon={BookOpen} /><StatCard label="Assessments" value="8,430" icon={CheckCircle2} tone="green" /><StatCard label="Avg Accuracy" value="84%" icon={Target} /><StatCard label="Avg WCPM" value="106" icon={Timer} tone="purple" /></div>
      <div className="grid gap-6 xl:grid-cols-2"><TrendChart title="User growth" dataKey="users" color="#4169F5" source={classPerformance} /><TrendChart title="Assessments completed" dataKey="assessments" color="#32A66A" source={classPerformance} type="bar" /></div>
      <Card><SectionTitle title="Recent Platform Activity" /><div className="grid gap-3 md:grid-cols-2">{recentActivity.concat(["New Level 4 lesson published.", "Parent engagement increased by 12% this week."]).map((item) => <div key={item} className="rounded-xl border border-border p-4 text-sm font-medium text-muted">{item}</div>)}</div></Card>
    </div>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h1 className="text-3xl font-extrabold tracking-normal text-text md:text-4xl">{title}</h1><p className="mt-2 text-base text-muted">{subtitle}</p></div>;
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="mb-4 text-xl font-extrabold text-text">{title}</h2>;
}

function Widget({ title, value, progress }: { title: string; value: string; progress: number }) {
  return <Card><div className="flex items-center justify-between"><h3 className="font-bold">{title}</h3><span className="text-sm font-bold text-primary">{value}</span></div><ProgressBar value={progress} className="mt-4" /></Card>;
}

function TrendChart({ title, dataKey, color, type = "line", source = trendData }: { title: string; dataKey: string; color: string; type?: "line" | "bar"; source?: Array<Record<string, string | number>> }) {
  return (
    <Card><SectionTitle title={title} /><ResponsiveContainer width="100%" height={260}>{type === "bar" ? <BarChart data={source}><CartesianGrid stroke="#E4E7F0" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey={dataKey} fill={color} radius={8} /></BarChart> : <ReLineChart data={source}><CartesianGrid stroke="#E4E7F0" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Line dataKey={dataKey} stroke={color} strokeWidth={3} dot={{ r: 4 }} /></ReLineChart>}</ResponsiveContainer></Card>
  );
}

function Feedback({ title, items, tone }: { title: string; items: string[]; tone: "green" | "orange" }) {
  return <Card><SectionTitle title={title} /><div className="space-y-3">{items.map((item) => <div key={item} className="flex gap-3 rounded-xl bg-[#F8F9FD] p-4 text-sm font-medium text-muted"><CheckCircle2 className={`mt-0.5 h-4 w-4 ${tone === "green" ? "text-success" : "text-warning"}`} />{item}</div>)}</div></Card>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#EEF3FF] p-4"><div className="text-2xl font-extrabold text-primary">{value}</div><div className="text-xs font-bold text-muted">{label}</div></div>;
}
