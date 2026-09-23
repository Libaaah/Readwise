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
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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
  CircularProgress,
  EmptyState,
  Input,
  LessonCard,
  LinkButton,
  Modal,
  ProgressBar,
  SearchBar,
  Select,
  StatCard,
  Table,
  Tabs,
  Toast,
} from "./components/ui";
import { assessments, assignments, classPerformance, currentStudent, lessons, monthlyActivity, recentActivity, students, trendData } from "./data/mockData";
import { ReadingActivitiesPage, ReadingActivityPage, SharedReadingProgress, StudentProgressSummary } from "./components/ReadingActivity";
import type { NavItem } from "./types";

const studentNav: NavItem[] = [
  { label: "Dashboard", path: "/student/dashboard", icon: Home },
  { label: "My Reading Activities", path: "/student/activities", icon: BookOpen },
  { label: "My Lessons", path: "/student/lessons", icon: BookOpen },
  { label: "Reading Activity", path: "/student/reading/brave-explorer", icon: Mic },
  { label: "Basic Result", path: "/student/assessment/a-104", icon: Star },
];

const teacherNav: NavItem[] = [
  { label: "Dashboard", path: "/teacher/dashboard", icon: Home },
  { label: "Students", path: "/teacher/students/anaya", icon: Users },
  { label: "Class Overview", path: "/teacher/dashboard", icon: BarChart3 },
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
      <Route path="/student/dashboard" element={<Shell nav={studentNav} user={{ name: "Anaya Rao", role: "Student" }} subtitle="Grade 4 - Level 3"><StudentDashboard /></Shell>} />
      <Route path="/student/activities" element={<Shell nav={studentNav} user={{ name: "Anaya Rao", role: "Student" }} subtitle="Grade 4 - Level 3"><ReadingActivitiesPage /></Shell>} />
      <Route path="/student/activity/:activityId" element={<Shell nav={studentNav} user={{ name: "Anaya Rao", role: "Student" }} subtitle="Grade 4 - Level 3"><ReadingActivityPage /></Shell>} />
      <Route path="/student/lessons" element={<Shell nav={studentNav} user={{ name: "Anaya Rao", role: "Student" }} subtitle="Grade 4 - Level 3"><LessonsPage /></Shell>} />
      <Route path="/student/reading/:lessonId" element={<Shell nav={studentNav} user={{ name: "Anaya Rao", role: "Student" }} subtitle="Grade 4 - Level 3"><ReadingPage /></Shell>} />
      <Route path="/student/assessment/:assessmentId" element={<Shell nav={studentNav} user={{ name: "Anaya Rao", role: "Student" }} subtitle="Grade 4 - Level 3"><AssessmentPage /></Shell>} />
      <Route path="/teacher/dashboard" element={<RoleGuard role="teacher"><Shell nav={teacherNav} user={{ name: "Ms. Sarah", role: "Teacher" }} subtitle="Grade 4 Reading"><TeacherDashboard /></Shell></RoleGuard>} />
      <Route path="/teacher/students/:studentId" element={<RoleGuard role="teacher"><Shell nav={teacherNav} user={{ name: "Ms. Sarah", role: "Teacher" }} subtitle="Grade 4 Reading"><StudentPerformance /></Shell></RoleGuard>} />
      <Route path="/parent/dashboard" element={<RoleGuard role="parent"><Shell nav={parentNav} user={{ name: "Priya Rao", role: "Parent" }} subtitle="Anaya's family"><ParentDashboard /></Shell></RoleGuard>} />
      <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
    </Routes>
  );
}

function RoleGuard({ role, children }: { role: "teacher" | "parent"; children: React.ReactNode }) {
  return sessionStorage.getItem("readwise-demo-role") === role ? <>{children}</> : <Navigate to="/login" replace />;
}

function Shell({ nav, user, subtitle, children }: { nav: NavItem[]; user: { name: string; role: string }; subtitle: string; children: React.ReactNode }) {
  return (
    <AppLayout nav={nav} user={user} subtitle={subtitle}>
      {children}
    </AppLayout>
  );
}

function AuthVisual() {
  return (
    <div className="relative hidden min-h-screen overflow-hidden bg-navy p-10 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(65,105,245,.45),transparent_34%),radial-gradient(circle_at_78%_70%,rgba(50,166,106,.28),transparent_30%)]" />
      <div className="relative">
        <div className="mb-16 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-lg font-extrabold text-primary">RW</div>
          <div>
            <div className="text-2xl font-extrabold">READWISE</div>
            <div className="text-sm text-white/70">Read. Practice. Progress.</div>
          </div>
        </div>
        <Badge>Semester 1 MVP - 30% Scope</Badge>
        <h1 className="mt-4 max-w-xl text-5xl font-extrabold leading-tight tracking-normal">Read Better. Grow Every Day.</h1>
        <p className="mt-5 max-w-lg text-lg leading-8 text-white/75">A focused first-semester prototype for student login, lesson browsing, read-aloud practice, and basic teacher review.</p>
      </div>
      <div className="relative grid grid-cols-3 gap-4">
        {[
          ["Core Screens", "6"],
          ["MVP Done", "30%"],
          ["Next Phase", "70%"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
            <div className="text-3xl font-extrabold">{value}</div>
            <div className="mt-1 text-sm text-white/70">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Login() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const demoAccounts = [
    { role: "Student", email: "student@readwise.demo", password: "Readwise123!", path: "/student/dashboard" },
    { role: "Teacher", email: "teacher@readwise.demo", password: "Readwise123!", path: "/teacher/dashboard" },
    { role: "Parent", email: "parent@readwise.demo", password: "Readwise123!", path: "/parent/dashboard" },
  ];
  function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!values.email.includes("@")) next.email = "Enter a valid email address.";
    if (!values.password) next.password = "Enter your password.";
    const account = demoAccounts.find((item) => item.email === values.email.trim().toLowerCase() && item.password === values.password);
    if (!Object.keys(next).length && !account) next.credentials = "Email or password is incorrect. Use one of the demo accounts below.";
    setErrors(next);
    if (!Object.keys(next).length && account) {
      sessionStorage.setItem("readwise-demo-role", account.role.toLowerCase());
      navigate(account.path);
    } else {
      sessionStorage.removeItem("readwise-demo-role");
    }
  }
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]">
      <AuthVisual />
      <main className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md space-y-5">
          <div className="lg:hidden"><div className="mb-8 text-2xl font-extrabold text-navy">READWISE</div></div>
          <div>
            <h1 className="text-3xl font-extrabold text-text">Welcome back!</h1>
            <p className="mt-2 text-muted">Sign in to try the Semester 1 reading-practice prototype.</p>
          </div>
          <Input label="Email" type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} error={errors.email} />
          <div>
            <Input label="Password" type={show ? "text" : "password"} value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} error={errors.password} />
            <div className="mt-2 flex justify-between text-sm">
              <button type="button" onClick={() => setShow(!show)} className="font-semibold text-primary">{show ? "Hide" : "Show"} password</button>
              <button type="button" className="font-semibold text-primary">Forgot password?</button>
            </div>
          </div>
          {errors.credentials ? <p className="text-sm font-medium text-danger" role="alert">{errors.credentials}</p> : null}
          <Button className="w-full" type="submit">Sign In</Button>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="outline">Google</Button>
            <Button type="button" variant="outline">Microsoft</Button>
          </div>
          <p className="text-center text-sm text-muted">New to READWISE? <a className="font-bold text-primary" href="/signup">Create a demo account</a></p>
          <Card className="space-y-3 bg-[#F8F9FD] p-4">
            <div className="text-sm font-bold text-text">Demo sign-in accounts</div>
            {demoAccounts.map((account) => <div key={account.role} className="text-xs leading-5 text-muted"><span className="font-bold text-text">{account.role}:</span> {account.email}<br />Password: {account.password}</div>)}
          </Card>
        </form>
      </main>
    </div>
  );
}

function Signup() {
  const navigate = useNavigate();
  const [role, setRole] = useState("Student");
  const [accepted, setAccepted] = useState(false);
  const [values, setValues] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (values.name.trim().length < 2) next.name = "Enter your full name.";
    if (!values.email.includes("@")) next.email = "Enter a valid email.";
    if (values.password.length < 6) next.password = "Use at least 6 characters.";
    if (values.password !== values.confirm) next.confirm = "Passwords must match.";
    if (!accepted) next.terms = "Accept the terms to continue.";
    setErrors(next);
    if (!Object.keys(next).length) navigate(role === "Teacher" ? "/teacher/dashboard" : role === "Parent" ? "/parent/dashboard" : "/student/dashboard");
  }
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]">
      <AuthVisual />
      <main className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-md space-y-4">
          <h1 className="text-3xl font-extrabold text-text">Create your account</h1>
          <Input label="Full name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} error={errors.name} />
          <Input label="Email" type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} error={errors.email} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Password" type="password" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} error={errors.password} />
            <Input label="Confirm password" type="password" value={values.confirm} onChange={(e) => setValues({ ...values, confirm: e.target.value })} error={errors.confirm} />
          </div>
          <div>
            <span className="mb-2 block text-sm font-semibold text-text">Role</span>
            <div className="grid grid-cols-3 gap-2">
              {["Student", "Teacher", "Parent"].map((item) => (
                <button key={item} type="button" onClick={() => setRole(item)} className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${role === item ? "border-primary bg-[#EEF3FF] text-primary" : "border-border text-muted"}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <label className="flex gap-3 text-sm text-muted">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4" />
            I agree to the terms and privacy policy.
          </label>
          {errors.terms ? <div className="text-xs font-medium text-danger">{errors.terms}</div> : null}
          <Button className="w-full" type="submit">Create Account</Button>
          <div className="grid gap-3 sm:grid-cols-2"><Button type="button" variant="outline">Google</Button><Button type="button" variant="outline">Microsoft</Button></div>
          <p className="text-center text-sm text-muted">Already have an account? <a className="font-bold text-primary" href="/login">Log in</a></p>
        </form>
      </main>
    </div>
  );
}

function StudentDashboard() {
  const continueLesson = lessons[0];
  return (
    <div className="space-y-6">
      <PageTitle title="Hi, Anaya!" subtitle="Let's continue your reading journey." />
      <SemesterScope />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Demo Lessons" value="5" icon={BookOpen} />
        <StatCard label="Sample WCPM" value="118" icon={Timer} tone="purple" />
        <StatCard label="Sample Accuracy" value="92%" icon={Target} tone="green" />
        <StatCard label="MVP Scope" value="30%" icon={Sparkles} tone="orange" />
      </div>
      <StudentProgressSummary />
      <ReadingActivitiesPage />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="grid gap-6 md:grid-cols-[240px_1fr]">
            <div className="min-h-56 rounded-2xl bg-[#EEF3FF] p-5"><Badge>Continue Learning</Badge><div className="mt-12 text-5xl font-extrabold text-primary">60%</div></div>
            <div className="flex flex-col justify-center">
              <div className="text-sm font-bold text-primary">{continueLesson.category}</div>
              <h2 className="mt-2 text-2xl font-extrabold text-text">{continueLesson.title}</h2>
              <p className="mt-3 text-muted">{continueLesson.level} - 5 min remaining - 118 WCPM</p>
              <ProgressBar value={continueLesson.progress} className="mt-5" />
              <LinkButton to={`/student/reading/${continueLesson.id}`} className="mt-6 w-full sm:w-fit">Continue Reading</LinkButton>
            </div>
          </Card>
          <SectionTitle title="Demo Lesson Set" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{lessons.slice(1).map((lesson) => <LessonCard key={lesson.id} lesson={lesson} compact />)}</div>
        </div>
        <div className="space-y-4">
          <Widget title="Daily Streak" value="7 days" progress={70} />
          <Widget title="Weekly Goal" value="4 of 5 lessons" progress={80} />
          <Widget title="Overall Progress" value="68%" progress={68} />
        </div>
      </div>
    </div>
  );
}

function LessonsPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("All");
  const [category, setCategory] = useState("All");
  const filtered = lessons.filter((lesson) => {
    const matchesQuery = `${lesson.title} ${lesson.description}`.toLowerCase().includes(query.toLowerCase());
    const matchesTab = tab === "All" || lesson.status === tab;
    const matchesCategory = category === "All" || lesson.category === category;
    return matchesQuery && matchesTab && matchesCategory;
  });
  return (
    <div className="space-y-6">
      <PageTitle title="My Lessons" subtitle="Semester 1 includes lesson browsing, simple filters, and a read-aloud demo flow." />
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
  const lesson = lessons.find((item) => item.id === lessonId) ?? lessons[0];
  const [state, setState] = useState<"idle" | "recording" | "paused" | "completed">("idle");
  const [seconds, setSeconds] = useState(0);
  const words = lesson.passage.join(" ").split(" ");
  const highlighted = state === "recording" ? Math.min(words.length, 36) : state === "completed" ? words.length : 0;
  function start() {
    setState("recording");
    setSeconds(22);
  }
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl font-extrabold text-text">{lesson.title}</h1><p className="text-sm font-medium text-muted">{lesson.level} - Reading progress {lesson.progress}%</p></div>
        <div className="flex items-center gap-3"><Badge tone="purple"><Clock className="mr-1 h-3 w-3" /> {seconds || 0}s</Badge><Button variant="outline" onClick={() => navigate("/student/lessons")}>Exit</Button></div>
      </Card>
      <Card className="p-6 md:p-10">
        <div className="mb-6 flex items-center justify-between"><Badge>{state === "idle" ? "Ready to read?" : state === "recording" ? "Recording your reading..." : state === "paused" ? "Paused" : "Reading complete"}</Badge><ProgressBar value={state === "completed" ? 100 : state === "recording" ? 58 : lesson.progress} className="max-w-52" /></div>
        <article className="text-xl leading-10 text-text md:text-2xl md:leading-[3.25rem]">
          {words.map((word, index) => (
            <span key={`${word}-${index}`} className={index < highlighted ? "rounded bg-[#FFF4DE] px-1 font-semibold" : ""}>{word} </span>
          ))}
        </article>
      </Card>
      <Card className="sticky bottom-4 p-5">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <div className="flex items-center gap-3">
            <button onClick={state === "idle" ? start : state === "recording" ? () => setState("paused") : state === "paused" ? () => setState("recording") : start} className="grid h-20 w-20 place-items-center rounded-full bg-primary text-white shadow-soft" aria-label="Microphone recording control">
              {state === "recording" ? <Pause className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
            </button>
            <div><div className="font-bold text-text">{state === "idle" ? "Ready to read?" : state === "completed" ? "Reading complete" : "Recording simulation active"}</div><div className="text-sm text-muted">Microphone permission is requested when recording starts.</div></div>
          </div>
          <div className="flex w-full items-center gap-2 md:w-auto">
            <div className="hidden h-12 flex-1 items-end gap-1 md:flex">{Array.from({ length: 18 }).map((_, i) => <span key={i} className="w-2 rounded bg-primary/70" style={{ height: `${12 + ((i * 7) % 30)}px` }} />)}</div>
            <Button variant="outline" onClick={() => setState("paused")} disabled={state !== "recording"}><Pause className="h-4 w-4" />Pause</Button>
            <Button variant="secondary" onClick={() => setState("completed")} disabled={state === "idle"}><Square className="h-4 w-4" />Stop</Button>
            <Button onClick={() => navigate("/student/assessment/a-104")} disabled={state !== "completed"}>Finish Reading</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function AssessmentPage() {
  const assessment = assessments[0];
  return (
    <div className="space-y-6">
      <PageTitle title="Great job, Anaya!" subtitle="Your basic reading result is ready for the Semester 1 prototype." />
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CircularProgress value={assessment.overall} label="Overall Score" /></Card>
        <Card><CircularProgress value={assessment.accuracy} label="Accuracy" color="#32A66A" /></Card>
        <Card><CircularProgress value={Math.round((assessment.wcpm / 140) * 100)} label={`${assessment.wcpm} WCPM`} color="#6C4CE8" /></Card>
        <Card><CircularProgress value={assessment.pronunciation} label="Pronunciation" color="#F5A623" /></Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <SectionTitle title="Previous Result vs Today's Result" />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[{ name: "Previous", accuracy: 89, wcpm: 112 }, { name: "Today", accuracy: assessment.accuracy, wcpm: assessment.wcpm }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E4E7F0" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="accuracy" fill="#4169F5" radius={8} /><Bar dataKey="wcpm" fill="#32A66A" radius={8} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="space-y-3">
          <h2 className="text-xl font-bold">Assessment Summary</h2>
          {["Lesson", assessment.lesson, "Date", assessment.date, "Reading duration", assessment.duration, "Words read", String(assessment.wordsRead)].map((item, index) => index % 2 === 0 ? <div key={item} className="pt-2 text-xs font-bold uppercase text-muted">{item}</div> : <div key={item} className="text-base font-semibold text-text">{item}</div>)}
        </Card>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Feedback title="What You Did Well" tone="green" items={["Strong reading accuracy across familiar words.", "Good reading pace with steady WCPM growth.", "Clear expression in the final paragraph."]} />
        <Feedback title="What to Improve" tone="orange" items={["Practice difficult words before recording.", "Pause at commas to improve fluency.", "Slow slightly on longer science words."]} />
      </div>
      <div className="flex flex-wrap gap-3"><LinkButton to="/student/lessons">Continue Learning</LinkButton><Button variant="outline" disabled>Detailed analytics in Semester 2</Button></div>
    </div>
  );
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

function TeacherDashboard() {
  return (
    <div className="space-y-6">
      <PageTitle title="Good morning, Ms. Sarah" subtitle="Basic class monitoring for the first-semester MVP." />
      <SemesterScope />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Demo Students" value="3" icon={Users} /><StatCard label="Active Readers" value="2" icon={Activity} tone="green" /><StatCard label="Avg Accuracy" value="86%" icon={Target} /><StatCard label="Avg WCPM" value="104" icon={Timer} tone="purple" /></div>
      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <Card><SectionTitle title="Class Performance" /><ResponsiveContainer width="100%" height={300}><AreaChart data={classPerformance}><CartesianGrid stroke="#E4E7F0" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Area dataKey="accuracy" stroke="#4169F5" fill="#EEF3FF" /><Area dataKey="completion" stroke="#32A66A" fill="#E8F7EF" /></AreaChart></ResponsiveContainer></Card>
        <Card><SectionTitle title="Recent Activity" /><div className="space-y-4">{recentActivity.map((item) => <div key={item} className="rounded-xl bg-[#F8F9FD] p-4 text-sm font-medium text-muted">{item}</div>)}</div></Card>
      </div>
      <SharedReadingProgress audience="teacher" />
      <Card><SectionTitle title="Students in Demo Class" /><Table headers={["Student", "Accuracy", "WCPM", "Progress", "Status", "Action"]} rows={students.map((s) => [<div className="flex items-center gap-3"><Avatar name={s.name} /><span className="font-bold">{s.name}</span></div>, `${s.accuracy}%`, s.wcpm, <ProgressBar value={s.progress} />, <Badge tone={s.status === "On Track" ? "green" : "orange"}>{s.status}</Badge>, <LinkButton to={`/teacher/students/${s.id}`} variant="outline">View</LinkButton>])} /></Card>
    </div>
  );
}

function StudentPerformance() {
  const { studentId } = useParams();
  const student = students.find((s) => s.id === studentId) ?? currentStudent;
  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-5"><Avatar name={student.name} size="lg" /><div><h1 className="text-3xl font-extrabold">{student.name}</h1><p className="text-muted">{student.grade} - {student.className} - {student.level}</p></div><Badge tone="green">{student.status}</Badge></Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Accuracy" value={`${student.accuracy}%`} icon={Target} /><StatCard label="WCPM" value={student.wcpm} icon={Timer} tone="purple" /><StatCard label="Fluency" value={`${student.fluency}%`} icon={Activity} tone="green" /><StatCard label="Lessons" value={student.lessonsCompleted} icon={BookOpen} tone="orange" /></div>
      <div className="grid gap-6 xl:grid-cols-2"><TrendChart title="Reading performance" dataKey="activity" color="#4169F5" /><TrendChart title="Accuracy trend" dataKey="accuracy" color="#32A66A" /><TrendChart title="WCPM trend" dataKey="wcpm" color="#6C4CE8" /><Card><SectionTitle title="Teacher Feedback" /><textarea className="min-h-40 w-full rounded-xl border border-border p-4 text-sm" placeholder="Add notes for this student" /><Button className="mt-3">Add Feedback</Button></Card></div>
      <Card><SectionTitle title="Assessment History" /><Table headers={["Lesson", "Date", "Accuracy", "WCPM", "Pronunciation", "Action"]} rows={assessments.map((a) => [a.lesson, a.date, `${a.accuracy}%`, a.wcpm, `${a.pronunciation}%`, <LinkButton to={`/student/assessment/${a.id}`} variant="outline">View Assessment</LinkButton>])} /></Card>
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
  return (
    <div className="space-y-6">
      <PageTitle title="Welcome back!" subtitle="Anaya's reading progress is steady and easy to follow." />
      <Card className="grid gap-5 md:grid-cols-[auto_1fr_auto]"><Avatar name={currentStudent.name} size="lg" /><div><h2 className="text-2xl font-extrabold">{currentStudent.name}</h2><p className="text-muted">{currentStudent.grade} - {currentStudent.level}</p><ProgressBar value={currentStudent.progress} className="mt-4" /></div><div className="grid grid-cols-2 gap-3 text-center"><Metric label="Accuracy" value="92%" /><Metric label="WCPM" value="118" /></div></Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Lessons Completed" value="24" icon={BookOpen} /><StatCard label="Reading Time" value="12h" icon={Clock} tone="orange" /><StatCard label="Current Streak" value="7 days" icon={Sparkles} tone="green" /><StatCard label="Recent Assessment" value="91" icon={CheckCircle2} tone="purple" /></div>
      <SharedReadingProgress audience="parent" />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]"><TrendChart title="Reading Progress" dataKey="accuracy" color="#4169F5" /><Card><SectionTitle title="How You Can Help" /><div className="space-y-3">{["Read together for 10 minutes each evening.", "Practice difficult words before a lesson.", "Build vocabulary by asking Anaya to explain new words.", "Encourage daily reading without rushing pace."].map((item) => <div key={item} className="rounded-xl bg-[#F8F9FD] p-4 text-sm font-medium text-muted">{item}</div>)}</div></Card></div>
    </div>
  );
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

function SemesterScope() {
  return (
    <Card className="border-primary/20 bg-[#F8FBFF]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Badge>Semester 1 - 30% Implementation</Badge>
          <h2 className="mt-3 text-xl font-extrabold text-text">Core prototype only</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
            This milestone covers login/signup, student lesson browsing, read-aloud simulation, basic assessment results, and a teacher view for demo student progress.
          </p>
        </div>
        <div className="grid gap-2 text-sm font-semibold text-muted sm:grid-cols-2 lg:w-[420px]">
          <div className="rounded-xl bg-white p-3">Semester 1: Functional demo screens</div>
          <div className="rounded-xl bg-white p-3">Semester 2: Real AI, parent/admin, analytics</div>
        </div>
      </div>
    </Card>
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

