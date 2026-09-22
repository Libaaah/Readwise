import type { LucideIcon } from "lucide-react";

export type Role = "student" | "teacher" | "parent" | "admin";

export type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
};

export type Lesson = {
  id: string;
  title: string;
  category: string;
  description: string;
  level: string;
  difficulty: "Easy" | "Medium" | "Challenging";
  duration: number;
  progress: number;
  rating: number;
  status: "In Progress" | "Completed" | "Not Started";
  color: string;
  passage: string[];
};

export type Assessment = {
  id: string;
  lessonId: string;
  lesson: string;
  date: string;
  duration: string;
  wordsRead: number;
  overall: number;
  accuracy: number;
  wcpm: number;
  pronunciation: number;
};

export type Student = {
  id: string;
  name: string;
  grade: string;
  className: string;
  level: string;
  accuracy: number;
  wcpm: number;
  fluency: number;
  progress: number;
  lessonsCompleted: number;
  status: string;
};

export type Assignment = {
  id: string;
  title: string;
  lesson: string;
  className: string;
  dueDate: string;
  completion: number;
  status: "Active" | "Draft" | "Due Soon";
};
