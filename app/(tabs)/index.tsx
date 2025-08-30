import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Clock, User, MapPin, Users } from 'lucide-react-native';
import { StorageManager } from '@/utils/storage';
import { TimetableData, Session } from '@/types';

const { width: screenWidth } = Dimensions.get('window');

export default function TimetableScreen() {
  const [timetableData, setTimetableData] = useState<TimetableData | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
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

  const markSessionAttendance = async (sessionId: string, status: 'present' | 'absent' | 'off' | 'mixed' | null) => {
    try {
      await StorageManager.markSessionAttendance(sessionId, status);
      await loadTimetableData(); // Reload data
      setSelectedSession(null);
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

  const getAttendanceBadge = (status: string | null) => {
    switch (status) {
      case 'present': return 'P';
      case 'absent': return 'A';
      case 'off': return 'O';
      case 'mixed': return 'M';
      default: return '';
    }
  };

  const renderSessionCell = (day: string, time: string) => {
    if (!timetableData) return null;

    const sessions = timetableData.sessions.filter(s => s.day === day && s.start_time === time);
    
    if (sessions.length === 0) {
      return (
        <View style={[styles.sessionCell, styles.emptyCell]}>
          <Text style={styles.emptyCellText}>Free</Text>
        </View>
      );
    }

    return (
      <View style={styles.sessionCell}>
        {sessions.map((session, index) => (
          <TouchableOpacity
            key={session.id}
            style={[
              styles.sessionItem,
              index > 0 && styles.sessionItemBorder,
              { borderLeftColor: getAttendanceColor(session.attendance_marked) }
            ]}
            onPress={() => setSelectedSession(session)}
          >
            <View style={styles.sessionHeader}>
              <Text style={styles.subjectName} numberOfLines={2}>
                {session.subject_name}
              </Text>
              {session.attendance_marked && (
                <View style={[styles.attendanceBadge, { backgroundColor: getAttendanceColor(session.attendance_marked) }]}>
                  <Text style={styles.attendanceBadgeText}>
                    {getAttendanceBadge(session.attendance_marked)}
                  </Text>
                </View>
              )}
            </View>
            
            {session.session_type && (
              <View style={styles.sessionTypeBadge}>
                <Text style={styles.sessionTypeText}>{session.session_type}</Text>
              </View>
            )}
            
            {session.lecturer && (
              <Text style={styles.lecturerName} numberOfLines={1}>
                {session.lecturer}
              </Text>
            )}
            
            {session.room && (
              <Text style={styles.roomText} numberOfLines={1}>
                📍 {session.room}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Calendar size={48} color="#3B82F6" />
          <Text style={styles.loadingText}>Loading timetable...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!timetableData || timetableData.sessions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Calendar size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No Timetable Data</Text>
          <Text style={styles.emptyText}>
            Import your Excel timetable file to get started with attendance tracking.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const cellWidth = (screenWidth - 80) / (timetableData.days.length + 1);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Weekly Timetable</Text>
        {timetableData.importMetadata && (
          <Text style={styles.subtitle}>
            Last imported: {new Date(timetableData.lastImported || '').toLocaleDateString()}
          </Text>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
        <ScrollView showsVerticalScrollIndicator={false} style={styles.verticalScroll}>
          <View style={styles.timetableContainer}>
            {/* Header Row */}
            <View style={styles.headerRow}>
              <View style={[styles.headerCell, styles.timeHeaderCell, { width: cellWidth }]}>
                <Text style={styles.headerText}>Time</Text>
              </View>
              {timetableData.days.map(day => (
                <View key={day} style={[styles.headerCell, { width: cellWidth }]}>
                  <Text style={styles.headerText}>{day.slice(0, 3)}</Text>
                </View>
              ))}
            </View>

            {/* Time Slots */}
            {timetableData.timeslots.map(time => (
              <View key={time} style={styles.timeRow}>
                <View style={[styles.timeCell, { width: cellWidth }]}>
                  <Text style={styles.timeText}>{time}</Text>
                </View>
                {timetableData.days.map(day => (
                  <View key={`${day}-${time}`} style={{ width: cellWidth }}>
                    {renderSessionCell(day, time)}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Session Detail Modal */}
      {selectedSession && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedSession.subject_name}</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setSelectedSession(null)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalDetails}>
              <View style={styles.detailRow}>
                <Clock size={16} color="#6B7280" />
                <Text style={styles.detailText}>
                  {selectedSession.day}, {selectedSession.start_time}
                </Text>
              </View>

              {selectedSession.lecturer && (
                <View style={styles.detailRow}>
                  <User size={16} color="#6B7280" />
                  <Text style={styles.detailText}>{selectedSession.lecturer}</Text>
                </View>
              )}

              {selectedSession.room && (
                <View style={styles.detailRow}>
                  <MapPin size={16} color="#6B7280" />
                  <Text style={styles.detailText}>{selectedSession.room}</Text>
                </View>
              )}

              {selectedSession.groups.length > 0 && (
                <View style={styles.detailRow}>
                  <Users size={16} color="#6B7280" />
                  <Text style={styles.detailText}>
                    {selectedSession.groups.join(', ')}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.attendanceTitle}>Mark Attendance</Text>
            <View style={styles.attendanceButtons}>
              <TouchableOpacity
                style={[
                  styles.attendanceButton,
                  { backgroundColor: '#10B981' },
                  selectedSession.attendance_marked === 'present' && styles.selectedButton
                ]}
                onPress={() => markSessionAttendance(selectedSession.id, 'present')}
              >
                <Text style={styles.attendanceButtonText}>Present</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.attendanceButton,
                  { backgroundColor: '#EF4444' },
                  selectedSession.attendance_marked === 'absent' && styles.selectedButton
                ]}
                onPress={() => markSessionAttendance(selectedSession.id, 'absent')}
              >
                <Text style={styles.attendanceButtonText}>Absent</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.attendanceButton,
                  { backgroundColor: '#6B7280' },
                  selectedSession.attendance_marked === 'off' && styles.selectedButton
                ]}
                onPress={() => markSessionAttendance(selectedSession.id, 'off')}
              >
                <Text style={styles.attendanceButtonText}>Off</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.attendanceButton,
                  { backgroundColor: '#E5E7EB' },
                  !selectedSession.attendance_marked && styles.selectedButton
                ]}
                onPress={() => markSessionAttendance(selectedSession.id, null)}
              >
                <Text style={[styles.attendanceButtonText, { color: '#374151' }]}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
  horizontalScroll: {
    flex: 1,
  },
  verticalScroll: {
    flex: 1,
  },
  timetableContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 4,
  },
  headerCell: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  timeHeaderCell: {
    backgroundColor: '#E5E7EB',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  timeRow: {
    flexDirection: 'row',
    marginBottom: 4,
    minHeight: 80,
  },
  timeCell: {
    backgroundColor: '#F3F4F6',
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    borderRadius: 4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#374151',
  },
  sessionCell: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    marginLeft: 1,
    minHeight: 78,
    overflow: 'hidden',
  },
  emptyCell: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCellText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  sessionItem: {
    padding: 6,
    borderLeftWidth: 3,
    flex: 1,
  },
  sessionItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 4,
    paddingTop: 6,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  subjectName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 4,
  },
  attendanceBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attendanceBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: 'white',
  },
  sessionTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2,
  },
  sessionTypeText: {
    fontSize: 8,
    fontWeight: '500',
    color: '#3B82F6',
  },
  lecturerName: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 2,
  },
  roomText: {
    fontSize: 9,
    color: '#6B7280',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxWidth: 400,
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalDetails: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  attendanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  attendanceButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  attendanceButton: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectedButton: {
    transform: [{ scale: 0.95 }],
    opacity: 0.8,
  },
  attendanceButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
});