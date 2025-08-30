import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Lock, Clock as Unlock, Trash2, Download, Settings as SettingsIcon, Clock, Target, Smartphone, CreditCard as Edit3, Save, X } from 'lucide-react-native';
import { NotificationManager } from '@/utils/notificationManager';
import { StorageManager } from '@/utils/storage';
import { TimetableData } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationSettings {
  dailyNotifications: boolean;
  classReminders: boolean;
  reminderMinutes: number;
  attendanceWarnings: boolean;
  attendanceThreshold: number;
  persistentNotification: boolean;
}

export default function SettingsScreen() {
  const [timetableData, setTimetableData] = useState<TimetableData | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    dailyNotifications: true,
    classReminders: true,
    reminderMinutes: 15,
    attendanceWarnings: true,
    attendanceThreshold: 75,
    persistentNotification: false,
  });
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [data, settings] = await Promise.all([
        StorageManager.loadTimetableData(),
        loadNotificationSettings()
      ]);
      setTimetableData(data);
      setNotificationSettings(settings);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotificationSettings = async (): Promise<NotificationSettings> => {
    try {
      const settings = await AsyncStorage.getItem('notification_settings');
      return settings ? JSON.parse(settings) : {
        dailyNotifications: true,
        classReminders: true,
        reminderMinutes: 15,
        attendanceWarnings: true,
        attendanceThreshold: 75,
        persistentNotification: false,
      };
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      return {
        dailyNotifications: true,
        classReminders: true,
        reminderMinutes: 15,
        attendanceWarnings: true,
        attendanceThreshold: 75,
        persistentNotification: false,
      };
    }
  };

  const saveNotificationSettings = async (newSettings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem('notification_settings', JSON.stringify(newSettings));
      setNotificationSettings(newSettings);

      // Apply notification changes
      if (newSettings.dailyNotifications) {
        await NotificationManager.scheduleDailyTimetableNotification();
      } else {
        await NotificationManager.cancelDailyNotifications();
      }

      if (newSettings.persistentNotification) {
        await NotificationManager.createPersistentTimetableNotification();
      } else {
        await NotificationManager.cancelPersistentNotification();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save notification settings');
    }
  };

  const updateNotificationSetting = (key: keyof NotificationSettings, value: any) => {
    const newSettings = { ...notificationSettings, [key]: value };
    saveNotificationSettings(newSettings);
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all timetable data, attendance records, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await StorageManager.clearTimetableData();
              await AsyncStorage.removeItem('notification_settings');
              await NotificationManager.cancelDailyNotifications();
              await NotificationManager.cancelPersistentNotification();
              setTimetableData(null);
              Alert.alert('Success', 'All data has been cleared');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data');
            }
          }
        }
      ]
    );
  };

  const exportData = async () => {
    try {
      if (!timetableData) {
        Alert.alert('No Data', 'No timetable data to export');
        return;
      }

      const exportData = {
        ...timetableData,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };

      // For mobile, we'll show the JSON data that can be copied
      Alert.alert(
        'Export Data',
        'Your timetable data is ready. You can copy this JSON data and save it as a backup.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Show Data',
            onPress: () => {
              Alert.alert(
                'Timetable Data',
                JSON.stringify(exportData, null, 2).substring(0, 500) + '...',
                [{ text: 'OK' }]
              );
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
    }
  };

  const editSubjectName = async (oldName: string, newName: string) => {
    if (!timetableData || !newName.trim() || oldName === newName) return;

    try {
      // Update sessions
      const updatedSessions = timetableData.sessions.map(session => 
        session.subject_name === oldName 
          ? { ...session, subject_name: newName.trim() }
          : session
      );

      // Update subjects
      const updatedSubjects = { ...timetableData.subjects };
      if (updatedSubjects[oldName]) {
        updatedSubjects[newName.trim()] = {
          ...updatedSubjects[oldName],
          name: newName.trim()
        };
        delete updatedSubjects[oldName];
      }

      const updatedData = {
        ...timetableData,
        sessions: updatedSessions,
        subjects: updatedSubjects
      };

      await StorageManager.saveTimetableData(updatedData);
      setTimetableData(updatedData);
      setEditingSubject(null);
      
      // Update notifications if they're enabled
      if (notificationSettings.persistentNotification) {
        await NotificationManager.updatePersistentNotification();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update subject name');
    }
  };

  const testNotification = async () => {
    try {
      await NotificationManager.createPersistentTimetableNotification();
      Alert.alert('Success', 'Test notification sent! Check your notification panel.');
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <SettingsIcon size={48} color="#3B82F6" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>
            Manage notifications, data, and app preferences
          </Text>
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Bell size={20} color="#3B82F6" />
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Daily Timetable</Text>
              <Text style={styles.settingDescription}>
                Show today's complete schedule at 7 AM
              </Text>
            </View>
            <Switch
              value={notificationSettings.dailyNotifications}
              onValueChange={(value) => updateNotificationSetting('dailyNotifications', value)}
              trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Class Reminders</Text>
              <Text style={styles.settingDescription}>
                Remind before each class starts
              </Text>
            </View>
            <Switch
              value={notificationSettings.classReminders}
              onValueChange={(value) => updateNotificationSetting('classReminders', value)}
              trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Persistent Schedule</Text>
              <Text style={styles.settingDescription}>
                Pin today's schedule in notification panel
              </Text>
            </View>
            <View style={styles.settingActions}>
              <TouchableOpacity
                style={[
                  styles.lockButton,
                  notificationSettings.persistentNotification && styles.lockButtonActive
                ]}
                onPress={() => updateNotificationSetting('persistentNotification', !notificationSettings.persistentNotification)}
              >
                {notificationSettings.persistentNotification ? (
                  <Lock size={16} color="white" />
                ) : (
                  <Unlock size={16} color="#6B7280" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Attendance Warnings</Text>
              <Text style={styles.settingDescription}>
                Alert when attendance drops below {notificationSettings.attendanceThreshold}%
              </Text>
            </View>
            <Switch
              value={notificationSettings.attendanceWarnings}
              onValueChange={(value) => updateNotificationSetting('attendanceWarnings', value)}
              trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <TouchableOpacity style={styles.testButton} onPress={testNotification}>
            <Smartphone size={16} color="#3B82F6" />
            <Text style={styles.testButtonText}>Test Notification</Text>
          </TouchableOpacity>
        </View>

        {/* Subject Management */}
        {timetableData && Object.keys(timetableData.subjects).length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Edit3 size={20} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Subject Management</Text>
            </View>

            {Object.entries(timetableData.subjects).map(([subjectName, subject]) => (
              <View key={subjectName} style={styles.subjectItem}>
                <View style={styles.subjectInfo}>
                  <Text style={styles.subjectName} numberOfLines={2}>
                    {subjectName}
                  </Text>
                  <Text style={styles.subjectStats}>
                    {subject.attended_classes}/{subject.total_classes} classes • {subject.percentage.toFixed(1)}%
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.editSubjectButton}
                  onPress={() => {
                    setEditingSubject(subjectName);
                    setEditedName(subjectName);
                  }}
                >
                  <Edit3 size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Data Management */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SettingsIcon size={20} color="#3B82F6" />
            <Text style={styles.sectionTitle}>Data Management</Text>
          </View>

          <TouchableOpacity style={styles.actionButton} onPress={exportData}>
            <Download size={18} color="#059669" />
            <Text style={styles.actionButtonText}>Export Data</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={clearAllData}>
            <Trash2 size={18} color="#EF4444" />
            <Text style={[styles.actionButtonText, styles.dangerText]}>Clear All Data</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.appInfo}>
            Attendance & Timetable Manager v1.0{'\n'}
            Built with Expo React Native
          </Text>
        </View>
      </ScrollView>

      {/* Edit Subject Modal */}
      <Modal
        visible={editingSubject !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingSubject(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Subject Name</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setEditingSubject(null)}
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Subject Name</Text>
              <TextInput
                style={styles.input}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Enter subject name"
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditingSubject(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => {
                  if (editingSubject) {
                    editSubjectName(editingSubject, editedName);
                  }
                }}
              >
                <Save size={16} color="white" />
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
  content: {
    flex: 1,
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
  section: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 12,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  settingActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  lockButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  subjectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  subjectInfo: {
    flex: 1,
    marginRight: 16,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  subjectStats: {
    fontSize: 12,
    color: '#6B7280',
  },
  editSubjectButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  dangerButton: {
    backgroundColor: '#FEF2F2',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  dangerText: {
    color: '#EF4444',
  },
  appInfo: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    minHeight: 48,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});