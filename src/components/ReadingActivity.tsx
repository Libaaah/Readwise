import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Mic, Square } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, LinkButton, ProgressBar, StatCard } from "./ui";
import { compareReading, loadReadingProgress, readingActivities, saveReadingProgress, type ReadingProgress } from "../data/readingProgress";

type RecognitionAlternative = { transcript: string };
type RecognitionResult = ArrayLike<RecognitionAlternative> & { isFinal: boolean };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionError = { error: string };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionError) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };

export function ReadingActivitiesPage() {
  const { items, available } = loadReadingProgress();
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-extrabold text-text">My Reading Activities</h1><p className="mt-2 text-muted">Choose a short passage, read it aloud, and see how you did.</p></div>
      {!available ? <StorageNotice /> : null}
      <div className="grid gap-5 md:grid-cols-2">
        {readingActivities.map((activity) => {
          const progress = items.find((item) => item.activityId === activity.id);
          return <Card key={activity.id} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3"><div><Badge tone="purple">Reading practice</Badge><h2 className="mt-3 text-xl font-extrabold text-text">{activity.title}</h2></div>{progress ? <Badge tone="green">Completed</Badge> : <Badge tone="gray">Not started</Badge>}</div>
            <p className="text-sm leading-6 text-muted">{activity.passage}</p>
            {progress ? <p className="text-sm font-semibold text-primary">Latest accuracy: {progress.accuracy === null ? "Not available" : `${progress.accuracy}%`}</p> : null}
            <LinkButton to={`/student/activity/${activity.id}`} className="mt-auto w-fit">{progress ? "Read Again" : "Start Reading"}</LinkButton>
          </Card>;
        })}
      </div>
    </div>
  );
}

export function ReadingActivityPage() {
  const { activityId = "" } = useParams();
  const activity = readingActivities.find((item) => item.id === activityId);
  const navigate = useNavigate();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [recognitionStatus, setRecognitionStatus] = useState<"idle" | "listening" | "processing" | "ready" | "unavailable">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReadingProgress | null>(null);
  const [saved, setSaved] = useState(true);

  useEffect(() => () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch { /* Recognition may already be stopped. */ }
    }
  }, []);

  if (!activity) return <div className="space-y-4"><Link to="/student/activities" className="inline-flex items-center gap-2 text-sm font-bold text-primary"><ArrowLeft className="h-4 w-4" />All activities</Link><Card><h1 className="text-xl font-bold">Activity not found</h1><p className="mt-2 text-muted">Choose one of the available reading passages.</p></Card></div>;
  const selectedActivity = activity;

  async function startRecording() {
    setError("");
    setTranscript("");
    setResult(null);
    setRecorded(false);
    setRecognitionStatus("idle");
    setRequesting(true);
    setAudioUrl("");
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Audio recording is not supported in this browser. Try the latest version of Chrome or Edge.");
      setRequesting(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = URL.createObjectURL(blob);
        setAudioUrl(audioUrlRef.current);
        setRecorded(blob.size > 0);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (blob.size === 0) setError("No audio was captured. Please try recording again.");
      };
      recorder.onerror = () => setError("The recording stopped unexpectedly. Please try again.");
      recorder.start();
      setRecording(true);
      setRequesting(false);
      const Recognition = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
      if (!Recognition) {
        setRecognitionStatus("unavailable");
      } else {
        try {
          const recognition = new Recognition();
          recognitionRef.current = recognition;
          recognition.continuous = true;
          recognition.interimResults = false;
          recognition.lang = "en-US";
          recognition.onresult = (event) => {
            const parts: string[] = [];
            for (let index = 0; index < event.results.length; index += 1) {
              const result = event.results[index];
              const alternative = result?.[0];
              if (result?.isFinal && alternative?.transcript) parts.push(alternative.transcript.trim());
            }
            setTranscript(parts.join(" "));
          };
          recognition.onerror = () => {
            setRecognitionStatus("unavailable");
            setError("Speech-to-text is unavailable in this browser or microphone session. Your recording is still available to play back.");
          };
          recognition.onend = () => setRecognitionStatus((status) => status === "unavailable" ? status : "ready");
          recognition.start();
          setRecognitionStatus("listening");
        } catch {
          setRecognitionStatus("unavailable");
          setError("Speech-to-text could not start. Your recording can still be played back, but no accuracy score will be calculated.");
        }
      }
    } catch (reason) {
      setRequesting(false);
      const denied = reason instanceof DOMException && (reason.name === "NotAllowedError" || reason.name === "PermissionDeniedError");
      setError(denied ? "Microphone permission was denied. Allow microphone access in your browser settings and try again." : "Could not access the microphone. Check that it is connected and try again.");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function stopRecording() {
    if (!recorderRef.current || recorderRef.current.state !== "recording") return;
    setRecording(false);
    setRecognitionStatus((status) => status === "listening" ? "processing" : status);
    recorderRef.current.stop();
    try { recognitionRef.current?.stop(); } catch { /* Recognition may already be stopped. */ }
  }

  function submitReading() {
    if (!recorded || recording) {
      setError("Record and stop your reading before submitting it.");
      return;
    }
    if (recognitionStatus === "processing" || recognitionStatus === "listening") {
      setError("Finishing speech recognition. Please wait a moment, then submit again.");
      return;
    }
    if (!selectedActivity.passage.trim()) {
      setError("This activity has no passage to analyze.");
      return;
    }
    const comparison = transcript.trim() ? compareReading(selectedActivity.passage, transcript) : null;
    const completed: ReadingProgress = {
      activityId: selectedActivity.id,
      activityTitle: selectedActivity.title,
      student: "Anaya Rao",
      completed: true,
      accuracy: comparison?.accuracy ?? null,
      expectedWords: comparison?.expectedWords ?? selectedActivity.passage.split(/\s+/).filter(Boolean).length,
      matchedWords: comparison?.matchedWords ?? 0,
      date: new Date().toISOString(),
      transcript: transcript.trim(),
      differences: comparison?.differences ?? [],
    };
    setResult(completed);
    setSaved(saveReadingProgress(completed));
    setError("");
  }

  const feedback = result?.accuracy === null ? "Your recording is saved. Speech-to-text is unavailable, so no reading accuracy score was calculated." : result && result.accuracy >= 90 ? "Excellent reading! Keep it up." : result && result.accuracy >= 70 ? "Good progress! Practice the difficult words again." : "Keep practicing. Try reading the passage slowly and clearly.";
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/student/activities" className="inline-flex items-center gap-2 text-sm font-bold text-primary"><ArrowLeft className="h-4 w-4" />All activities</Link>
      <div><Badge tone="purple">Reading practice</Badge><h1 className="mt-3 text-3xl font-extrabold text-text">{activity.title}</h1><p className="mt-2 text-muted">Read the passage aloud clearly. When you are ready, click Start Recording.</p></div>
      <Card><p className="text-lg leading-8 text-text">{activity.passage}</p></Card>
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {!recording ? <Button onClick={startRecording} disabled={requesting}><Mic className="h-4 w-4" />{requesting ? "Requesting microphone…" : recorded ? "Record Again" : "Start Recording"}</Button> : <Button onClick={stopRecording} variant="danger"><Square className="h-4 w-4" />Stop Recording</Button>}
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${recording ? "bg-red-50 text-danger" : "bg-[#F3F5FA] text-muted"}`}><span className={`h-2.5 w-2.5 rounded-full ${recording ? "animate-pulse bg-danger" : "bg-quiet"}`} />{requesting ? "Waiting for microphone permission…" : recording ? "Recording… Read the passage now." : recorded ? "Recording complete. Play it back or submit." : "Click Start Recording to begin."}</span>
        </div>
        {audioUrl ? <audio className="w-full" controls src={audioUrl}>Audio playback is not supported by this browser.</audio> : null}
        <div className="rounded-xl bg-[#F8F9FD] p-4 text-sm text-muted">Speech recognition listens while you read. Browser support varies. Audio is kept in this browser and is not uploaded.</div>
        {recognitionStatus === "processing" ? <p className="text-sm font-semibold text-primary">Finishing speech recognition…</p> : null}
        {recognitionStatus === "unavailable" ? <p className="text-sm text-warning">This browser did not provide speech-to-text. You can still submit the recording, but no transcript or accuracy score will be shown.</p> : null}
        {error ? <p className="flex items-start gap-2 text-sm font-medium text-danger" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p> : null}
        <Button onClick={submitReading} disabled={recording || requesting || recognitionStatus === "processing" || recognitionStatus === "listening"}><CheckCircle2 className="h-4 w-4" />Submit Reading</Button>
      </Card>
      {result ? <Card className="space-y-5">
        <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-success" /><h2 className="text-2xl font-extrabold text-text">Reading Result</h2></div>
        <p className="font-semibold text-text">{feedback}</p>
        {!saved ? <StorageNotice /> : <p className="text-sm text-success">Progress saved on this device.</p>}
        {result.accuracy === null ? <p className="text-sm text-muted">No transcript was returned. Reading accuracy cannot be calculated without recognized text.</p> : <>
          <div className="grid gap-4 sm:grid-cols-2"><StatCard label="Reading Accuracy" value={`${result.accuracy}%`} icon={CheckCircle2} tone={result.accuracy >= 90 ? "green" : result.accuracy >= 70 ? "orange" : "purple"} /><StatCard label="Words Matched" value={`${result.matchedWords} / ${result.expectedWords}`} icon={CheckCircle2} /></div>
          <div><div className="mb-2 flex justify-between text-sm font-semibold text-muted"><span>Reading Accuracy</span><span>{result.accuracy}%</span></div><ProgressBar value={result.accuracy} /></div>
          <div><h3 className="font-bold text-text">Your Reading</h3><p className="mt-2 rounded-xl bg-[#F8F9FD] p-4 text-sm leading-6 text-muted">{result.transcript}</p></div>
          <div><h3 className="font-bold text-text">Words to practice</h3>{result.differences.length ? <ul className="mt-2 space-y-2">{result.differences.map((difference, index) => <li key={`${difference.expected}-${index}`} className="rounded-lg bg-[#FFF4DE] px-3 py-2 text-sm text-text">Expected “{difference.expected}”{difference.heard ? `, heard “${difference.heard}”` : ", not heard"}</li>)}</ul> : <p className="mt-2 text-sm text-success">All expected words matched.</p>}</div>
        </>}
        <Button variant="outline" onClick={() => navigate("/student/dashboard")}>Return to dashboard</Button>
      </Card> : null}
    </div>
  );
}

export function StudentProgressSummary() {
  const { items, available } = loadReadingProgress();
  const latest = [...items].sort((a, b) => b.date.localeCompare(a.date))[0];
  return <Card className="space-y-4">
    <div><h2 className="text-xl font-extrabold text-text">My Progress</h2><p className="mt-1 text-sm text-muted">Your reading activity and latest result.</p></div>
    {!available ? <StorageNotice /> : null}
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[#F8F9FD] p-4"><div className="text-2xl font-extrabold text-primary">{items.length} / {readingActivities.length}</div><div className="text-xs font-bold text-muted">Activities completed</div></div><div className="rounded-xl bg-[#F8F9FD] p-4"><div className="text-2xl font-extrabold text-primary">{latest?.accuracy === null || !latest ? "—" : `${latest.accuracy}%`}</div><div className="text-xs font-bold text-muted">Latest accuracy</div></div><div className="rounded-xl bg-[#F8F9FD] p-4"><div className="truncate text-sm font-bold text-text">{latest?.activityTitle ?? "No reading yet"}</div><div className="text-xs font-bold text-muted">Last completed reading</div></div></div>
    <LinkButton to="/student/activities" variant="secondary">{latest ? "Continue reading" : "Start a reading activity"}</LinkButton>
  </Card>;
}

export function SharedReadingProgress({ audience }: { audience: "teacher" | "parent" }) {
  const { items, available } = loadReadingProgress();
  const latest = [...items].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (audience === "parent") return <Card className="space-y-4">
    <div><h2 className="text-xl font-extrabold text-text">Reading Progress</h2><p className="mt-1 text-sm text-muted">Anaya’s latest reading activity.</p></div>
    {!available ? <StorageNotice /> : null}
    <div className="grid gap-3 sm:grid-cols-3"><StatCard label="Activities Completed" value={`${items.length} / ${readingActivities.length}`} icon={CheckCircle2} tone="green" /><StatCard label="Latest Reading Accuracy" value={latest?.accuracy === null || !latest ? "—" : `${latest.accuracy}%`} icon={CheckCircle2} tone="purple" /><div className="rounded-2xl border border-border bg-white p-4"><div className="text-sm font-bold text-text">{latest?.activityTitle ?? "No activity completed yet"}</div><div className="mt-1 text-xs text-muted">Latest activity</div></div></div>
    <div><div className="mb-2 flex justify-between text-xs font-semibold text-muted"><span>Activity completion</span><span>{Math.round((items.length / readingActivities.length) * 100)}%</span></div><ProgressBar value={(items.length / readingActivities.length) * 100} /></div>
  </Card>;

  return <Card className="space-y-4"><div><h2 className="text-xl font-extrabold text-text">Student Reading Progress</h2><p className="mt-1 text-sm text-muted">Latest saved activity results for Anaya Rao.</p></div>{!available ? <StorageNotice /> : null}<div className="overflow-x-auto"><table className="w-full min-w-[460px] text-left text-sm"><thead><tr className="text-muted"><th className="px-3 py-2">Activity</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Accuracy</th><th className="px-3 py-2">Date</th></tr></thead><tbody>{readingActivities.map((activity) => {
    const progress = items.find((item) => item.activityId === activity.id);
    return <tr key={activity.id} className="border-t border-border"><td className="px-3 py-3 font-semibold text-text">{activity.title}</td><td className="px-3 py-3">{progress ? <Badge tone="green">Completed</Badge> : <Badge tone="gray">Not completed</Badge>}</td><td className="px-3 py-3">{progress?.accuracy === null || !progress ? "—" : `${progress.accuracy}%`}</td><td className="px-3 py-3 text-muted">{progress ? new Date(progress.date).toLocaleDateString() : "—"}</td></tr>;
  })}</tbody></table></div>{latest ? <div className="rounded-xl bg-[#F8F9FD] p-4 text-sm text-muted">Latest: <span className="font-bold text-text">{latest.activityTitle}</span> — {latest.accuracy === null ? "speech-to-text unavailable" : `${latest.accuracy}% reading accuracy`}</div> : null}</Card>;
}

function StorageNotice() {
  return <p className="flex items-start gap-2 rounded-xl bg-[#FFF4DE] p-3 text-sm text-[#805500]" role="status"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Local storage is unavailable. Progress will not persist after leaving this page.</p>;
}
