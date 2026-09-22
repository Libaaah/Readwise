import type { Assessment, Assignment, Lesson, Student } from "../types";

export const currentStudent: Student = {
  id: "anaya",
  name: "Anaya Rao",
  grade: "Grade 4",
  className: "4A",
  level: "Level 3",
  accuracy: 92,
  wcpm: 118,
  fluency: 87,
  progress: 68,
  lessonsCompleted: 24,
  status: "On Track",
};

export const students: Student[] = [
  currentStudent,
  {
    id: "rohan",
    name: "Rohan Mehta",
    grade: "Grade 4",
    className: "4A",
    level: "Level 2",
    accuracy: 78,
    wcpm: 86,
    fluency: 72,
    progress: 44,
    lessonsCompleted: 13,
    status: "Needs Practice",
  },
  {
    id: "meera",
    name: "Meera Singh",
    grade: "Grade 4",
    className: "4B",
    level: "Level 3",
    accuracy: 84,
    wcpm: 101,
    fluency: 80,
    progress: 56,
    lessonsCompleted: 18,
    status: "Improving",
  },
];

export const lessons: Lesson[] = [
  {
    id: "brave-explorer",
    title: "The Brave Little Explorer",
    category: "Adventure Story",
    description: "A curious child follows a forest map and learns how courage grows one careful step at a time.",
    level: "Level 3",
    difficulty: "Medium",
    duration: 8,
    progress: 60,
    rating: 4.8,
    status: "In Progress",
    color: "bg-[#EEF3FF]",
    passage: [
      "Mira packed a small bag with water, a notebook, and the old map she found in her grandfather's study.",
      "The path through the forest was quiet at first, but soon she heard leaves moving and birds calling from high branches.",
      "When she reached the narrow bridge, Mira took a slow breath and stepped forward with steady feet.",
      "On the other side, a bright clearing opened before her, and she smiled because the map had led her to a hidden garden.",
    ],
  },
  {
    id: "stars-beyond",
    title: "Stars and Beyond",
    category: "Science",
    description: "Explore constellations, planets, and the questions that make night skies exciting.",
    level: "Level 3",
    difficulty: "Easy",
    duration: 6,
    progress: 0,
    rating: 4.7,
    status: "Not Started",
    color: "bg-[#F2EEFF]",
    passage: [
      "Every star in the sky is a distant sun, shining across space for many years before its light reaches us.",
      "Some stars form patterns called constellations, which helped travelers find their way long ago.",
    ],
  },
  {
    id: "journey-hills",
    title: "Journey to the Hills",
    category: "Nature",
    description: "A class trip becomes a lesson in patience, observation, and mountain weather.",
    level: "Level 2",
    difficulty: "Easy",
    duration: 7,
    progress: 100,
    rating: 4.6,
    status: "Completed",
    color: "bg-[#E8F7EF]",
    passage: ["The bus climbed higher as mist covered the hills and tiny flowers lined the road."],
  },
  {
    id: "under-ocean",
    title: "Under the Ocean",
    category: "Science",
    description: "Meet coral reefs, gentle currents, and the surprising teamwork of sea life.",
    level: "Level 4",
    difficulty: "Challenging",
    duration: 10,
    progress: 20,
    rating: 4.9,
    status: "In Progress",
    color: "bg-[#EAF8FF]",
    passage: ["Deep below the waves, sunlight fades slowly and ocean animals use color, sound, and movement to survive."],
  },
  {
    id: "kind-deer",
    title: "The Kind Deer",
    category: "Fable",
    description: "A gentle fable about helping others and noticing when someone needs a friend.",
    level: "Level 2",
    difficulty: "Medium",
    duration: 5,
    progress: 0,
    rating: 4.5,
    status: "Not Started",
    color: "bg-[#FFF4DE]",
    passage: ["At the edge of the meadow, a kind deer waited while a young rabbit found the courage to cross the stream."],
  },
];

export const assessments: Assessment[] = [
  {
    id: "a-104",
    lessonId: "brave-explorer",
    lesson: "The Brave Little Explorer",
    date: "Aug 29, 2026",
    duration: "4m 42s",
    wordsRead: 284,
    overall: 91,
    accuracy: 94,
    wcpm: 122,
    pronunciation: 88,
  },
  {
    id: "a-103",
    lessonId: "journey-hills",
    lesson: "Journey to the Hills",
    date: "Aug 26, 2026",
    duration: "5m 10s",
    wordsRead: 301,
    overall: 86,
    accuracy: 89,
    wcpm: 112,
    pronunciation: 84,
  },
];

export const trendData = [
  { name: "Mon", accuracy: 84, wcpm: 96, lessons: 2, activity: 18 },
  { name: "Tue", accuracy: 87, wcpm: 101, lessons: 3, activity: 24 },
  { name: "Wed", accuracy: 88, wcpm: 106, lessons: 2, activity: 20 },
  { name: "Thu", accuracy: 90, wcpm: 111, lessons: 4, activity: 32 },
  { name: "Fri", accuracy: 91, wcpm: 116, lessons: 3, activity: 26 },
  { name: "Sat", accuracy: 92, wcpm: 118, lessons: 2, activity: 22 },
  { name: "Sun", accuracy: 94, wcpm: 122, lessons: 3, activity: 28 },
];

export const monthlyActivity = [
  20, 35, 40, 25, 55, 60, 70, 48, 65, 72, 44, 35, 80, 76, 68, 45, 54, 62, 78, 84, 58, 42, 63, 71,
  66, 73, 88, 52,
];

export const assignments: Assignment[] = [
  {
    id: "as-1",
    title: "Adventure Fluency Practice",
    lesson: "The Brave Little Explorer",
    className: "Grade 4A",
    dueDate: "Sep 04, 2026",
    completion: 72,
    status: "Active",
  },
  {
    id: "as-2",
    title: "Science Reading Check",
    lesson: "Stars and Beyond",
    className: "Grade 4B",
    dueDate: "Sep 02, 2026",
    completion: 41,
    status: "Due Soon",
  },
  {
    id: "as-3",
    title: "Fable Comprehension",
    lesson: "The Kind Deer",
    className: "Grade 4A",
    dueDate: "Sep 09, 2026",
    completion: 0,
    status: "Draft",
  },
];

export const classPerformance = [
  { name: "Jun", accuracy: 78, wcpm: 88, completion: 62, users: 90, assessments: 120 },
  { name: "Jul", accuracy: 82, wcpm: 96, completion: 70, users: 118, assessments: 172 },
  { name: "Aug", accuracy: 86, wcpm: 104, completion: 79, users: 146, assessments: 240 },
  { name: "Sep", accuracy: 88, wcpm: 110, completion: 83, users: 184, assessments: 318 },
];

export const recentActivity = [
  "Anaya completed The Brave Little Explorer assessment.",
  "Rohan improved pronunciation by 8 points this week.",
  "Ms. Sarah created Adventure Fluency Practice.",
  "Meera reached a 5-day reading streak.",
];
