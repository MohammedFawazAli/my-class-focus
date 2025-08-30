import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { StorageManager } from './storage';
import { Session, TimetableData } from '@/types';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class NotificationManager {
  private static notificationPermission: boolean = false;

  static async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
      console.log('Must use physical device for notifications');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    this.notificationPermission = finalStatus === 'granted';
    return this.notificationPermission;
  }

  static async scheduleDailyTimetableNotification(): Promise<void> {
    if (!this.notificationPermission) {
      const granted = await this.requestPermissions();
      if (!granted) return;
    }

    try {
      // Cancel existing daily notifications
      await this.cancelDailyNotifications();

      const timetableData = await StorageManager.loadTimetableData();
      if (!timetableData) return;

      const today = new Date();
      const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
      
      const todaySessions = timetableData.sessions
        .filter(session => session.day === todayName)
        .sort((a, b) => {
          const timeA = a.start_time.split(':').map(Number);
          const timeB = b.start_time.split(':').map(Number);
          return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
        });

      if (todaySessions.length === 0) return;

      // Create notification content
      const notificationContent = this.formatDailyTimetable(todaySessions);

      // Schedule notification for 7 AM daily
      await Notifications.scheduleNotificationAsync({
        identifier: 'daily-timetable',
        content: {
          title: `📚 Today's Schedule - ${todayName}`,
          body: notificationContent.body,
          data: { 
            type: 'daily-timetable',
            sessions: todaySessions,
            fullContent: notificationContent.full
          },
          sticky: true, // Keep notification persistent
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          hour: 7,
          minute: 0,
          repeats: true,
        },
      });

      // Schedule pre-class reminders
      await this.scheduleClassReminders(todaySessions);

    } catch (error) {
      console.error('Failed to schedule daily notification:', error);
    }
  }

  static async scheduleClassReminders(sessions: Session[]): Promise<void> {
    for (const session of sessions) {
      const [hours, minutes] = session.start_time.split(':').map(Number);
      
      // Schedule reminder 15 minutes before class
      const reminderTime = new Date();
      reminderTime.setHours(hours, minutes - 15, 0, 0);

      if (reminderTime > new Date()) {
        await Notifications.scheduleNotificationAsync({
          identifier: `reminder-${session.id}`,
          content: {
            title: `📢 Class Starting Soon`,
            body: `${session.subject_name} starts in 15 minutes\n📍 ${session.room || 'Room TBA'}\n👨‍🏫 ${session.lecturer || 'Lecturer TBA'}`,
            data: { 
              type: 'class-reminder',
              sessionId: session.id,
              session: session
            },
          },
          trigger: reminderTime,
        });
      }
    }
  }

  static formatDailyTimetable(sessions: Session[]): { body: string; full: string } {
    if (sessions.length === 0) {
      return {
        body: 'No classes scheduled today! 🎉',
        full: 'No classes scheduled today! Enjoy your free day! 🎉'
      };
    }

    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    // Create condensed version for notification body
    const firstThree = sessions.slice(0, 3);
    const body = firstThree.map(session => 
      `${formatTime(session.start_time)} - ${session.subject_name.substring(0, 25)}${session.subject_name.length > 25 ? '...' : ''}`
    ).join('\n');

    const bodyWithMore = sessions.length > 3 
      ? `${body}\n... and ${sessions.length - 3} more classes`
      : body;

    // Create full version for expanded view
    const full = sessions.map(session => {
      const parts = [
        `🕐 ${formatTime(session.start_time)}`,
        `📚 ${session.subject_name}`,
        session.room ? `📍 ${session.room}` : '',
        session.lecturer ? `👨‍🏫 ${session.lecturer}` : '',
        session.session_type ? `📝 ${session.session_type}` : ''
      ].filter(Boolean);
      
      return parts.join('\n');
    }).join('\n\n');

    return { body: bodyWithMore, full };
  }

  static async cancelDailyNotifications(): Promise<void> {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    for (const notification of scheduledNotifications) {
      if (notification.identifier.startsWith('daily-timetable') || 
          notification.identifier.startsWith('reminder-')) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  }

  static async showLowAttendanceWarning(subjectName: string, percentage: number): Promise<void> {
    if (!this.notificationPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Low Attendance Warning',
        body: `${subjectName}: ${percentage.toFixed(1)}% attendance. You need to improve to meet minimum requirements.`,
        data: { 
          type: 'attendance-warning',
          subject: subjectName,
          percentage 
        },
      },
      trigger: null, // Show immediately
    });
  }

  static async showAttendanceGoalReached(subjectName: string, percentage: number): Promise<void> {
    if (!this.notificationPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 Attendance Goal Reached!',
        body: `Great job! ${subjectName} now has ${percentage.toFixed(1)}% attendance.`,
        data: { 
          type: 'attendance-success',
          subject: subjectName,
          percentage 
        },
      },
      trigger: null,
    });
  }

  static async createPersistentTimetableNotification(): Promise<void> {
    if (!this.notificationPermission) {
      const granted = await this.requestPermissions();
      if (!granted) return;
    }

    try {
      const timetableData = await StorageManager.loadTimetableData();
      if (!timetableData) return;

      const today = new Date();
      const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
      
      const todaySessions = timetableData.sessions
        .filter(session => session.day === todayName)
        .sort((a, b) => {
          const timeA = a.start_time.split(':').map(Number);
          const timeB = b.start_time.split(':').map(Number);
          return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
        });

      const content = this.formatDailyTimetable(todaySessions);

      // Create persistent notification
      await Notifications.scheduleNotificationAsync({
        identifier: 'persistent-timetable',
        content: {
          title: `📅 ${todayName}'s Schedule`,
          body: content.body,
          data: { 
            type: 'persistent-timetable',
            sessions: todaySessions,
            fullContent: content.full,
            locked: true
          },
          sticky: true,
          priority: Platform.OS === 'android' 
            ? Notifications.AndroidNotificationPriority.HIGH 
            : undefined,
        },
        trigger: null, // Show immediately
      });

    } catch (error) {
      console.error('Failed to create persistent notification:', error);
    }
  }

  static async updatePersistentNotification(): Promise<void> {
    // Cancel existing persistent notification
    await Notifications.cancelScheduledNotificationAsync('persistent-timetable');
    
    // Create new one with updated data
    await this.createPersistentTimetableNotification();
  }

  static async cancelPersistentNotification(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync('persistent-timetable');
  }
}