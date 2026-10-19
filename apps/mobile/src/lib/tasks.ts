import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Task {
  id: string;
  title: string;
  done: boolean;
  due?: string | null;
  createdAt: string;
}

const key = (ws: string) => `angelos.tasks.${ws}`;

export async function listTasks(ws: string): Promise<Task[]> {
  const raw = await AsyncStorage.getItem(key(ws));
  if (!raw) return [];
  try { return JSON.parse(raw) as Task[]; } catch { return []; }
}

export async function saveTasks(ws: string, tasks: Task[]): Promise<void> {
  await AsyncStorage.setItem(key(ws), JSON.stringify(tasks));
}

export async function addTask(ws: string, title: string, due?: string | null): Promise<Task> {
  const tasks = await listTasks(ws);
  const task: Task = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: title.trim(), done: false, due: due ?? null, createdAt: new Date().toISOString() };
  await saveTasks(ws, [task, ...tasks]);
  return task;
}

export async function updateTask(ws: string, id: string, patch: Partial<Pick<Task, 'title' | 'done' | 'due'>>): Promise<void> {
  const tasks = await listTasks(ws);
  const next = tasks.map((t) => t.id === id ? { ...t, ...patch } : t);
  await saveTasks(ws, next);
}

export async function deleteTask(ws: string, id: string): Promise<void> {
  const tasks = await listTasks(ws);
  await saveTasks(ws, tasks.filter((t) => t.id !== id));
}
