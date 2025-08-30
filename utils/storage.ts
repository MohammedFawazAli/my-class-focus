import AsyncStorage from '@react-native-async-storage/async-storage';
import { TimetableData, Subject, Session } from '@/types';

const STORAGE_KEY = 'timetable_data';

export class StorageManager {
  static async saveTimetableData(data: TimetableData): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save timetable data:', error);
      throw new Error('Failed to save data to storage');
    }
  }

  static async loadTimetableData(): Promise<TimetableData | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to load timetable data:', error);
      return null;
    }
  }

  static async clearTimetableData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear timetable data:', error);
      throw new Error('Failed to clear storage');
    }
  }

  static async updateAttendance(
    subjectName: string,
    attended: number,
    missed: number,
    total?: number
  ): Promise<void> {
    try {
      const data = await this.loadTimetableData();
      if (!data) return;

      if (!data.subjects[subjectName]) {
        data.subjects[subjectName] = {
          subject_id: `subject_${Date.now()}`,
          name: subjectName,
          attended_classes: 0,
          missed_classes: 0,
          total_classes: 0,
          percentage: 0
        };
      }

      const subject = data.subjects[subjectName];
      subject.attended_classes = attended;
      subject.missed_classes = missed;
      
      // Auto-calculate total if not provided
      if (total !== undefined) {
        subject.total_classes = total;
      } else {
        subject.total_classes = attended + missed;
      }
      
      subject.percentage = subject.total_classes > 0 
        ? Math.round((attended / subject.total_classes) * 10000) / 100
        : 0;

      await this.saveTimetableData(data);
    } catch (error) {
      console.error('Failed to update attendance:', error);
      throw new Error('Failed to update attendance data');
    }
  }

  static async markSessionAttendance(
    sessionId: string,
    status: 'present' | 'absent' | 'off' | 'mixed' | null
  ): Promise<void> {
    try {
      const data = await this.loadTimetableData();
      if (!data) return;

      const session = data.sessions.find(s => s.id === sessionId);
      if (!session) return;

      const oldStatus = session.attendance_marked;
      session.attendance_marked = status;

      // Update subject attendance counters
      const subject = data.subjects[session.subject_name];
      if (subject) {
        // Remove old status count
        if (oldStatus === 'present') subject.attended_classes--;
        else if (oldStatus === 'absent') subject.missed_classes--;

        // Add new status count
        if (status === 'present') subject.attended_classes++;
        else if (status === 'absent') subject.missed_classes++;

        // Recalculate percentage
        subject.total_classes = subject.attended_classes + subject.missed_classes;
        subject.percentage = subject.total_classes > 0 
          ? Math.round((subject.attended_classes / subject.total_classes) * 10000) / 100
          : 0;
      }

      await this.saveTimetableData(data);
    } catch (error) {
      console.error('Failed to mark session attendance:', error);
      throw new Error('Failed to update session attendance');
    }
  }

  static async addSessionNote(sessionId: string, note: string): Promise<void> {
    try {
      const data = await this.loadTimetableData();
      if (!data) return;

      const session = data.sessions.find(s => s.id === sessionId);
      if (session) {
        session.notes = note;
        await this.saveTimetableData(data);
      }
    } catch (error) {
      console.error('Failed to add session note:', error);
      throw new Error('Failed to add note');
    }
  }
}