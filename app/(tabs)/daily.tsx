import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Clock, User, MapPin, Users, CircleCheck as CheckCircle, X, Minus, CircleAlert as AlertCircle, Bell, Lock } from 'lucide-react-native';
import { StorageManager } from '@/utils/storage';
import { NotificationManager } from '@/utils/notificationManager';
import { TimetableData, Session } from '@/types';
import EditableSessionCard from '@/components/EditableSessionCard';

export default function DailyScreen() {
  const [timetableData, setTimetableData] = useState<TimetableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    loadTimetableData();
    checkNotificationPermissions();
  }, []);

  const loadTimetableData = async () => {
    try {
      const data = await StorageManager.loadTimetableData();
      setTimetableData(data);
    } catch (error) {
      console.error('Failed to load timetable data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkNotificationPermissions = async () => {
    const hasPermission = await NotificationManager.requestPermissions();
    setNotificationsEnabled(hasPermission);
  };

  const enableNotifications = async () => {
    try {
      await NotificationManager.scheduleDailyTimetableNotification();
      await NotificationManager.createPersistentTimetableNotification();
      Alert.alert('Success', 'Notifications enabled! You\'ll receive daily schedule updates.');
      setNotificationsEnabled(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to enable notifications');
    }
  };

  const markSessionAttendance = async (sessionId: string, status: 'present' | 'absent' | 'off' | 'mixed' | null) => {
    try {
      await StorageManager.markSessionAttendance(sessionId, status);
      await loadTimetableData();
    } catch (error) {
      Alert.alert('Error', 'Failed to mark attendance');
    }
  };

  const getAttendanceColor = (status: string | null) => {
    switch (status) {
      case 'present': return '#10B981';
      case 'absent': return '#EF4444';
      case 'off': return '#6B7280';
      case 'mixed': return '#F59E0B';
      default: return '#E5E7EB';
    }
  };

  const getAttendanceIcon = (status: string | null) => {
    switch (status) {
      case 'present': return CheckCircle;
      case 'absent': return X;
      case 'off': return Minus;
      case 'mixed': return AlertCircle;
      default: return null;
    }
  };

  const getTodayDay = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  const getTodaySessions = () => {
    if (!timetableData) return [];
    
    const todayDay = getTodayDay();
    const todaySessions = timetableData.sessions.filter(session => session.day === todayDay);
    
    // Sort by start time
    return todaySessions.sort((a, b) => {
      const timeA = a.start_time.split(':').map(Number);
      const timeB = b.start_time.split(':').map(Number);
      return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const isCurrentSession = (session: Session) => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const sessionTime = parseInt(session.start_time.split(':')[0]) * 60 + parseInt(session.start_time.split(':')[1]);
    const sessionEndTime = sessionTime + 60; // Assuming 1 hour duration
    
    return currentTime >= sessionTime && currentTime <= sessionEndTime;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Calendar size={48} color="#3B82F6" />
          <Text style={styles.loadingText}>Loading daily schedule...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!timetableData || timetableData.sessions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Calendar size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No Schedule Data</Text>
          <Text style={styles.emptyText}>
            Import your Excel timetable file to see your daily schedule.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const todaySessions = getTodaySessions();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Today's Schedule</Text>
        <Text style={styles.subtitle}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </Text>
        
        {todaySessions.length > 0 && (
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={enableNotifications}
          >
            <Lock size={16} color="#3B82F6" />
            <Text style={styles.notificationButtonText}>Pin to Notifications</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {todaySessions.length === 0 ? (
          <View style={styles.noSessionsContainer}>
            <Text style={styles.noSessionsText}>No classes scheduled for today!</Text>
            <Text style={styles.noSessionsSubtext}>Enjoy your free day 🎉</Text>
          </View>
        ) : (
          todaySessions.map((session, index) => {
            const isCurrent = isCurrentSession(session);
            
            return (
              <EditableSessionCard
                key={session.id} 
                session={session}
                onUpdate={loadTimetableData}
                isCurrentSession={isCurrent}
              />
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  notificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  notificationButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  noSessionsContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noSessionsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  noSessionsSubtext: {
    fontSize: 16,
    color: '#6B7280',
  },
});