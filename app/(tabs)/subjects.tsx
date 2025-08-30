import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChartBar as BarChart3, CreditCard as Edit3, Plus, Minus, TrendingUp, TrendingDown, Target, BookOpen } from 'lucide-react-native';
import * as Progress from 'react-native-progress';
import { StorageManager } from '@/utils/storage';
import { TimetableData, Subject } from '@/types';

export default function SubjectsScreen() {
  const [timetableData, setTimetableData] = useState<TimetableData | null>(null);
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ attended: '', missed: '', total: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimetableData();
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

  const updateSubjectAttendance = async (subjectName: string, attended: number, missed: number, total?: number) => {
    try {
      await StorageManager.updateAttendance(subjectName, attended, missed, total);
      await loadTimetableData();
      setEditingSubject(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to update attendance');
    }
  };

  const openEditModal = (subjectName: string, subject: Subject) => {
    setEditingSubject(subjectName);
    setEditValues({
      attended: subject.attended_classes.toString(),
      missed: subject.missed_classes.toString(),
      total: subject.total_classes.toString(),
    });
  };

  const saveChanges = () => {
    if (!editingSubject) return;

    const attended = parseInt(editValues.attended) || 0;
    const missed = parseInt(editValues.missed) || 0;
    let total = parseInt(editValues.total) || 0;

    // Auto-calculate total if it's less than attended + missed
    if (total < attended + missed) {
      total = attended + missed;
    }

    updateSubjectAttendance(editingSubject, attended, missed, total);
  };

  const quickAdjustAttendance = async (subjectName: string, type: 'attended' | 'missed', delta: number) => {
    const subject = timetableData?.subjects[subjectName];
    if (!subject) return;

    let newAttended = subject.attended_classes;
    let newMissed = subject.missed_classes;

    if (type === 'attended') {
      newAttended = Math.max(0, newAttended + delta);
    } else {
      newMissed = Math.max(0, newMissed + delta);
    }

    await updateSubjectAttendance(subjectName, newAttended, newMissed);
  };

  const getAttendanceStatus = (percentage: number) => {
    if (percentage >= 80) return { status: 'excellent', color: '#10B981', icon: TrendingUp };
    if (percentage >= 75) return { status: 'good', color: '#059669', icon: Target };
    if (percentage >= 70) return { status: 'warning', color: '#F59E0B', icon: TrendingDown };
    return { status: 'danger', color: '#EF4444', icon: TrendingDown };
  };

  const calculateOverallStats = () => {
    if (!timetableData) return { totalAttended: 0, totalMissed: 0, totalClasses: 0, overallPercentage: 0 };

    const subjects = Object.values(timetableData.subjects);
    const totalAttended = subjects.reduce((sum, subject) => sum + subject.attended_classes, 0);
    const totalMissed = subjects.reduce((sum, subject) => sum + subject.missed_classes, 0);
    const totalClasses = totalAttended + totalMissed;
    const overallPercentage = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 10000) / 100 : 0;

    return { totalAttended, totalMissed, totalClasses, overallPercentage };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <BarChart3 size={48} color="#3B82F6" />
          <Text style={styles.loadingText}>Loading attendance data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!timetableData || Object.keys(timetableData.subjects).length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <BookOpen size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No Subjects Found</Text>
          <Text style={styles.emptyText}>
            Import your timetable to start tracking attendance for your subjects.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const overallStats = calculateOverallStats();
  const subjects = Object.entries(timetableData.subjects).sort(([, a], [, b]) => 
    b.percentage - a.percentage
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Subject Attendance</Text>
          <Text style={styles.subtitle}>
            Track and manage attendance for all subjects
          </Text>
        </View>

        {/* Overall Statistics */}
        <View style={styles.overallStatsCard}>
          <Text style={styles.overallStatsTitle}>Overall Attendance</Text>
          
          <View style={styles.overallStatsContent}>
            <View style={styles.overallStatsNumber}>
              <Text style={styles.overallPercentage}>
                {overallStats.overallPercentage.toFixed(2)}%
              </Text>
              <Text style={styles.overallLabel}>Total Attendance</Text>
            </View>
            
            <View style={styles.overallProgressContainer}>
              <Progress.Bar
                progress={overallStats.overallPercentage / 100}
                width={150}
                height={8}
                borderRadius={4}
                color={getAttendanceStatus(overallStats.overallPercentage).color}
                unfilledColor="#E5E7EB"
                borderWidth={0}
              />
              <Text style={styles.overallProgressText}>
                {overallStats.totalAttended} / {overallStats.totalClasses} classes
              </Text>
            </View>
          </View>

          <View style={styles.overallStatsGrid}>
            <View style={styles.overallStatItem}>
              <Text style={styles.overallStatNumber}>{overallStats.totalAttended}</Text>
              <Text style={styles.overallStatLabel}>Attended</Text>
            </View>
            <View style={styles.overallStatItem}>
              <Text style={styles.overallStatNumber}>{overallStats.totalMissed}</Text>
              <Text style={styles.overallStatLabel}>Missed</Text>
            </View>
            <View style={styles.overallStatItem}>
              <Text style={styles.overallStatNumber}>{subjects.length}</Text>
              <Text style={styles.overallStatLabel}>Subjects</Text>
            </View>
          </View>
        </View>

        {/* Subject List */}
        <View style={styles.subjectsContainer}>
          {subjects.map(([subjectName, subject]) => {
            const attendanceStatus = getAttendanceStatus(subject.percentage);
            const StatusIcon = attendanceStatus.icon;
            
            return (
              <View key={subjectName} style={styles.subjectCard}>
                <View style={styles.subjectHeader}>
                  <View style={styles.subjectTitleContainer}>
                    <Text style={styles.subjectName} numberOfLines={2}>
                      {subjectName}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: attendanceStatus.color }]}>
                      <StatusIcon size={12} color="white" />
                      <Text style={styles.statusText}>{attendanceStatus.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.editButton}
                    onPress={() => openEditModal(subjectName, subject)}
                  >
                    <Edit3 size={18} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <View style={styles.attendanceDisplay}>
                  <Text style={[styles.percentageText, { color: attendanceStatus.color }]}>
                    {subject.percentage.toFixed(2)}%
                  </Text>
                  
                  <View style={styles.progressContainer}>
                    <Progress.Bar
                      progress={subject.percentage / 100}
                      width={200}
                      height={6}
                      borderRadius={3}
                      color={attendanceStatus.color}
                      unfilledColor="#E5E7EB"
                      borderWidth={0}
                    />
                    <Text style={styles.attendanceText}>
                      {subject.attended_classes} / {subject.total_classes} classes
                    </Text>
                  </View>
                </View>

                <View style={styles.quickActions}>
                  <View style={styles.quickActionGroup}>
                    <Text style={styles.quickActionLabel}>Attended: {subject.attended_classes}</Text>
                    <View style={styles.quickActionButtons}>
                      <TouchableOpacity
                        style={styles.quickActionButton}
                        onPress={() => quickAdjustAttendance(subjectName, 'attended', -1)}
                      >
                        <Minus size={14} color="#EF4444" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickActionButton}
                        onPress={() => quickAdjustAttendance(subjectName, 'attended', 1)}
                      >
                        <Plus size={14} color="#10B981" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.quickActionGroup}>
                    <Text style={styles.quickActionLabel}>Missed: {subject.missed_classes}</Text>
                    <View style={styles.quickActionButtons}>
                      <TouchableOpacity
                        style={styles.quickActionButton}
                        onPress={() => quickAdjustAttendance(subjectName, 'missed', -1)}
                      >
                        <Minus size={14} color="#EF4444" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickActionButton}
                        onPress={() => quickAdjustAttendance(subjectName, 'missed', 1)}
                      >
                        <Plus size={14} color="#10B981" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editingSubject !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingSubject(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Edit Attendance: {editingSubject}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Classes Attended</Text>
              <TextInput
                style={styles.input}
                value={editValues.attended}
                onChangeText={(text) => setEditValues(prev => ({ ...prev, attended: text }))}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Classes Missed</Text>
              <TextInput
                style={styles.input}
                value={editValues.missed}
                onChangeText={(text) => setEditValues(prev => ({ ...prev, missed: text }))}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Total Classes</Text>
              <TextInput
                style={styles.input}
                value={editValues.total}
                onChangeText={(text) => setEditValues(prev => ({ ...prev, total: text }))}
                keyboardType="numeric"
                placeholder="Auto-calculated"
              />
              <Text style={styles.inputHint}>
                Leave empty to auto-calculate from attended + missed
              </Text>
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
                onPress={saveChanges}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
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
  overallStatsCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  overallStatsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  overallStatsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  overallStatsNumber: {
    alignItems: 'center',
  },
  overallPercentage: {
    fontSize: 32,
    fontWeight: '700',
    color: '#3B82F6',
  },
  overallLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  overallProgressContainer: {
    alignItems: 'center',
  },
  overallProgressText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  overallStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  overallStatItem: {
    alignItems: 'center',
  },
  overallStatNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
  },
  overallStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  subjectsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  subjectCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  subjectTitleContainer: {
    flex: 1,
    marginRight: 16,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attendanceDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  percentageText: {
    fontSize: 28,
    fontWeight: '700',
  },
  progressContainer: {
    alignItems: 'center',
  },
  attendanceText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  quickActionGroup: {
    flex: 1,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  quickActionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
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
  },
  inputHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
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