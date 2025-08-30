import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Clock, User, MapPin, Users, CreditCard as Edit3, Save, X, CircleCheck as CheckCircle } from 'lucide-react-native';
import { Session } from '@/types';
import { StorageManager } from '@/utils/storage';

interface EditableSessionCardProps {
  session: Session;
  onUpdate: () => void;
  isCurrentSession?: boolean;
}

export default function EditableSessionCard({ 
  session, 
  onUpdate, 
  isCurrentSession = false 
}: EditableSessionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSession, setEditedSession] = useState({
    subject_name: session.subject_name,
    lecturer: session.lecturer || '',
    room: session.room || '',
    session_type: session.session_type || '',
  });

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const saveChanges = async () => {
    try {
      // Load current data
      const timetableData = await StorageManager.loadTimetableData();
      if (!timetableData) return;

      // Update the session
      const updatedSessions = timetableData.sessions.map(s => 
        s.id === session.id 
          ? {
              ...s,
              subject_name: editedSession.subject_name.trim(),
              lecturer: editedSession.lecturer.trim() || undefined,
              room: editedSession.room.trim() || undefined,
              session_type: editedSession.session_type.trim() || undefined,
            }
          : s
      );

      // Update subjects if name changed
      const updatedSubjects = { ...timetableData.subjects };
      if (session.subject_name !== editedSession.subject_name.trim()) {
        const oldSubject = updatedSubjects[session.subject_name];
        if (oldSubject) {
          updatedSubjects[editedSession.subject_name.trim()] = {
            ...oldSubject,
            name: editedSession.subject_name.trim()
          };
          delete updatedSubjects[session.subject_name];
        }
      }

      const updatedData = {
        ...timetableData,
        sessions: updatedSessions,
        subjects: updatedSubjects
      };

      await StorageManager.saveTimetableData(updatedData);
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      Alert.alert('Error', 'Failed to save changes');
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

  const markAttendance = async (status: 'present' | 'absent' | 'off' | null) => {
    try {
      await StorageManager.markSessionAttendance(session.id, status);
      onUpdate();
    } catch (error) {
      Alert.alert('Error', 'Failed to mark attendance');
    }
  };

  return (
    <>
      <View style={[
        styles.sessionCard,
        isCurrentSession && styles.currentSessionCard
      ]}>
        {isCurrentSession && (
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>CURRENT</Text>
          </View>
        )}

        <View style={styles.sessionHeader}>
          <View style={styles.timeContainer}>
            <Clock size={16} color="#6B7280" />
            <Text style={styles.timeText}>{formatTime(session.start_time)}</Text>
          </View>
          
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              setEditedSession({
                subject_name: session.subject_name,
                lecturer: session.lecturer || '',
                room: session.room || '',
                session_type: session.session_type || '',
              });
              setIsEditing(true);
            }}
          >
            <Edit3 size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <Text style={styles.subjectName}>{session.subject_name}</Text>

        <View style={styles.sessionDetails}>
          {session.session_type && (
            <View style={styles.sessionTypeBadge}>
              <Text style={styles.sessionTypeText}>{session.session_type}</Text>
            </View>
          )}

          {session.lecturer && (
            <View style={styles.detailRow}>
              <User size={14} color="#6B7280" />
              <Text style={styles.detailText}>{session.lecturer}</Text>
            </View>
          )}

          {session.room && (
            <View style={styles.detailRow}>
              <MapPin size={14} color="#6B7280" />
              <Text style={styles.detailText}>{session.room}</Text>
            </View>
          )}

          {session.groups.length > 0 && (
            <View style={styles.detailRow}>
              <Users size={14} color="#6B7280" />
              <Text style={styles.detailText} numberOfLines={1}>
                {session.groups.join(', ')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.attendanceActions}>
          <TouchableOpacity
            style={[
              styles.attendanceButton,
              styles.presentButton,
              session.attendance_marked === 'present' && styles.selectedAttendanceButton
            ]}
            onPress={() => markAttendance(
              session.attendance_marked === 'present' ? null : 'present'
            )}
          >
            <CheckCircle size={14} color={
              session.attendance_marked === 'present' ? 'white' : '#10B981'
            } />
            <Text style={[
              styles.attendanceButtonText,
              session.attendance_marked === 'present' && styles.selectedAttendanceText
            ]}>
              Present
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.attendanceButton,
              styles.absentButton,
              session.attendance_marked === 'absent' && styles.selectedAttendanceButton
            ]}
            onPress={() => markAttendance(
              session.attendance_marked === 'absent' ? null : 'absent'
            )}
          >
            <X size={14} color={
              session.attendance_marked === 'absent' ? 'white' : '#EF4444'
            } />
            <Text style={[
              styles.attendanceButtonText,
              session.attendance_marked === 'absent' && styles.selectedAttendanceText
            ]}>
              Absent
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.attendanceButton,
              styles.offButton,
              session.attendance_marked === 'off' && styles.selectedAttendanceButton
            ]}
            onPress={() => markAttendance(
              session.attendance_marked === 'off' ? null : 'off'
            )}
          >
            <Minus size={14} color={
              session.attendance_marked === 'off' ? 'white' : '#6B7280'
            } />
            <Text style={[
              styles.attendanceButtonText,
              session.attendance_marked === 'off' && styles.selectedAttendanceText
            ]}>
              Off
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Edit Modal */}
      <Modal
        visible={isEditing}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditing(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Session</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsEditing(false)}
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Subject Name</Text>
              <TextInput
                style={styles.input}
                value={editedSession.subject_name}
                onChangeText={(text) => setEditedSession(prev => ({ ...prev, subject_name: text }))}
                placeholder="Enter subject name"
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Lecturer</Text>
              <TextInput
                style={styles.input}
                value={editedSession.lecturer}
                onChangeText={(text) => setEditedSession(prev => ({ ...prev, lecturer: text }))}
                placeholder="Enter lecturer name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Room</Text>
              <TextInput
                style={styles.input}
                value={editedSession.room}
                onChangeText={(text) => setEditedSession(prev => ({ ...prev, room: text }))}
                placeholder="Enter room number"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Session Type</Text>
              <TextInput
                style={styles.input}
                value={editedSession.session_type}
                onChangeText={(text) => setEditedSession(prev => ({ ...prev, session_type: text }))}
                placeholder="P, L, T, etc."
                maxLength={3}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsEditing(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveChanges}
              >
                <Save size={16} color="white" />
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  sessionCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  currentSessionCard: {
    borderWidth: 2,
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.2,
  },
  currentBadge: {
    position: 'absolute',
    top: -8,
    left: 20,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 6,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subjectName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  sessionDetails: {
    marginBottom: 16,
  },
  sessionTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  sessionTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
    flex: 1,
  },
  attendanceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  attendanceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  presentButton: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  absentButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  offButton: {
    backgroundColor: '#F9FAFB',
    borderColor: '#6B7280',
  },
  selectedAttendanceButton: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  attendanceButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  selectedAttendanceText: {
    color: 'white',
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
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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