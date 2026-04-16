/**
 * iconMap.js a registry of the 60 pickable note icons.
 * Maps a stable string key to its Lucide component.
 * When adding new icons, append to this file — no other file needs to change.
 */

import {
  // Files
  FileText,
  File,
  FileCode,
  FileImage,
  FileSearch,
  FileSpreadsheet,
  FileCheck,
  FilePlus,
  // Writing
  Pencil,
  PenLine,
  BookOpen,
  BookMarked,
  Book,
  ClipboardList,
  Clipboard,
  // Ideas & Learning
  Lightbulb,
  Brain,
  GraduationCap,
  Microscope,
  Search,
  Eye,
  Glasses,
  // Work & Projects
  Briefcase,
  Building2,
  Target,
  Rocket,
  Layers,
  LayoutGrid,
  GitBranch,
  BarChart2,
  // Personal
  Star,
  Heart,
  Bookmark,
  Flag,
  Award,
  Trophy,
  Smile,
  Coffee,
  // Tech
  Code,
  Code2,
  Terminal,
  Bug,
  Database,
  Server,
  Cpu,
  Wifi,
  // Time & Planning
  Calendar,
  CalendarCheck,
  Clock,
  Timer,
  AlarmClock,
  Zap,
  // Media
  Music,
  Camera,
  Image,
  Video,
  // Misc
  Tag,
  Globe,
  Map,
  Home,
} from "lucide-vue-next";

export const ICON_MAP = {
  // Files
  FileText,
  File,
  FileCode,
  FileImage,
  FileSearch,
  FileSpreadsheet,
  FileCheck,
  FilePlus,
  // Writing
  Pencil,
  PenLine,
  BookOpen,
  BookMarked,
  Book,
  ClipboardList,
  Clipboard,
  // Ideas & Learning
  Lightbulb,
  Brain,
  GraduationCap,
  Microscope,
  Search,
  Eye,
  Glasses,
  // Work & Projects
  Briefcase,
  Building2,
  Target,
  Rocket,
  Layers,
  LayoutGrid,
  GitBranch,
  BarChart2,
  // Personal
  Star,
  Heart,
  Bookmark,
  Flag,
  Award,
  Trophy,
  Smile,
  Coffee,
  // Tech
  Code,
  Code2,
  Terminal,
  Bug,
  Database,
  Server,
  Cpu,
  Wifi,
  // Time & Planning
  Calendar,
  CalendarCheck,
  Clock,
  Timer,
  AlarmClock,
  Zap,
  // Media
  Music,
  Camera,
  Image,
  Video,
  // Misc
  Tag,
  Globe,
  Map,
  Home,
};

/** Resolve a stored icon name string to its Lucide component. Falls back to FileText. */
export function resolveIcon(name) {
  return ICON_MAP[name] || FileText;
}

/** Grouped list used by the IconPicker grid UI. */
export const ICON_GROUPS = [
  {
    label: "Files",
    icons: [
      "FileText",
      "File",
      "FileCode",
      "FileImage",
      "FileSearch",
      "FileSpreadsheet",
      "FileCheck",
      "FilePlus",
    ],
  },
  {
    label: "Writing",
    icons: [
      "Pencil",
      "PenLine",
      "BookOpen",
      "BookMarked",
      "Book",
      "ClipboardList",
      "Clipboard",
    ],
  },
  {
    label: "Ideas",
    icons: [
      "Lightbulb",
      "Brain",
      "GraduationCap",
      "Microscope",
      "Search",
      "Eye",
      "Glasses",
    ],
  },
  {
    label: "Work",
    icons: [
      "Briefcase",
      "Building2",
      "Target",
      "Rocket",
      "Layers",
      "LayoutGrid",
      "GitBranch",
      "BarChart2",
    ],
  },
  {
    label: "Personal",
    icons: [
      "Star",
      "Heart",
      "Bookmark",
      "Flag",
      "Award",
      "Trophy",
      "Smile",
      "Coffee",
    ],
  },
  {
    label: "Tech",
    icons: [
      "Code",
      "Code2",
      "Terminal",
      "Bug",
      "Database",
      "Server",
      "Cpu",
      "Wifi",
    ],
  },
  {
    label: "Time",
    icons: ["Calendar", "CalendarCheck", "Clock", "Timer", "AlarmClock", "Zap"],
  },
  {
    label: "Media & Misc",
    icons: ["Music", "Camera", "Image", "Video", "Tag", "Globe", "Map", "Home"],
  },
];
