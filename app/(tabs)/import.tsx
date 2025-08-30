import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { Upload, FileSpreadsheet, CircleCheck as CheckCircle, CircleAlert as AlertCircle, ArrowRight } from 'lucide-react-native';
import { ExcelParser } from '@/utils/excelParser';
import { StorageManager } from '@/utils/storage';
import { NotificationManager } from '@/utils/notificationManager';
import { ImportPreview, TimetableData } from '@/types';

export default function ImportScreen() {
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === 'web' 
          ? ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
             'application/vnd.ms-excel',
             'text/csv']
          : ['*/*'], // More permissive on mobile
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        console.log('Selected file:', result.assets[0]);
        setSelectedFile(result.assets[0].name);
        parseExcelFile(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const parseExcelFile = async (fileUri: string) => {
    setImporting(true);
    setPreview(null);
    
    try {
      const importPreview = await ExcelParser.parseExcelFile(fileUri);
      setPreview(importPreview);
    } catch (error) {
      Alert.alert('Parsing Error', error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = async () => {
    if (!preview) return;

    try {
      setImporting(true);
      
      // Check if existing data exists
      const existingData = await StorageManager.loadTimetableData();
      
      if (existingData && existingData.sessions.length > 0) {
        Alert.alert(
          'Merge with Existing Data?',
          'You have existing timetable data. How would you like to proceed?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Replace All', 
              style: 'destructive',
              onPress: () => performImport(false)
            },
            { 
              text: 'Merge', 
              onPress: () => performImport(true)
            }
          ]
        );
      } else {
        await performImport(false);
      }
    } catch (error) {
      Alert.alert('Import Error', 'Failed to import timetable data');
    } finally {
      setImporting(false);
    }
  };

  const performImport = async (merge: boolean) => {
    if (!preview) return;

    try {
      let finalData: TimetableData;
      
      if (merge) {
        const existingData = await StorageManager.loadTimetableData();
        
        // Merge logic: preserve existing attendance data
        const mergedSessions = [...preview.sessions];
        const mergedSubjects: { [key: string]: any } = {};
        
        // Initialize subjects from new sessions
        preview.sessions.forEach(session => {
          if (!mergedSubjects[session.subject_name]) {
            mergedSubjects[session.subject_name] = {
              subject_id: `subject_${session.subject_name.replace(/\s+/g, '_').toLowerCase()}`,
              name: session.subject_name,
              attended_classes: 0,
              missed_classes: 0,
              total_classes: 0,
              percentage: 0
            };
          }
        });
        
        // Merge existing subject data if available
        if (existingData) {
          Object.entries(existingData.subjects).forEach(([name, subject]) => {
            if (mergedSubjects[name]) {
              mergedSubjects[name] = subject;
            }
          });
        }

        finalData = {
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          timeslots: Array.from(new Set(preview.sessions.map(s => s.start_time))).sort(),
          sessions: mergedSessions,
          subjects: mergedSubjects,
          lastImported: new Date().toISOString(),
          importMetadata: {
            filename: selectedFile || 'unknown.xlsx',
            parsedSessions: preview.sessions.length,
            unparsedCells: preview.unparsedCells.length,
            confidence: preview.metadata.confidence
          }
        };
      } else {
        // Fresh import
        const subjects: { [key: string]: any } = {};
        
        preview.sessions.forEach(session => {
          if (!subjects[session.subject_name]) {
            subjects[session.subject_name] = {
              subject_id: `subject_${session.subject_name.replace(/\s+/g, '_').toLowerCase()}`,
              name: session.subject_name,
              attended_classes: 0,
              missed_classes: 0,
              total_classes: 0,
              percentage: 0
            };
          }
        });

        finalData = {
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          timeslots: Array.from(new Set(preview.sessions.map(s => s.start_time))).sort(),
          sessions: preview.sessions,
          subjects,
          lastImported: new Date().toISOString(),
          importMetadata: {
            filename: selectedFile || 'unknown.xlsx',
            parsedSessions: preview.sessions.length,
            unparsedCells: preview.unparsedCells.length,
            confidence: preview.metadata.confidence
          }
        };
      }

      await StorageManager.saveTimetableData(finalData);
      
      Alert.alert(
        'Import Successful!', 
        `Imported ${preview.sessions.length} sessions successfully. Would you like to enable notifications for your schedule?`,
        [
          { text: 'Not Now', onPress: () => setPreview(null) },
          { 
            text: 'Enable Notifications', 
            onPress: async () => {
              setPreview(null);
              try {
                await NotificationManager.scheduleDailyTimetableNotification();
                Alert.alert('Success', 'Notifications enabled! You\'ll receive daily schedule updates.');
              } catch (error) {
                console.error('Failed to enable notifications:', error);
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Import Error', 'Failed to save imported data');
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return '#10B981';
      case 'medium': return '#F59E0B';
      case 'low': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high': return CheckCircle;
      case 'medium': return AlertCircle;
      case 'low': return AlertCircle;
      default: return AlertCircle;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Import Timetable</Text>
          <Text style={styles.subtitle}>
            Upload your Excel timetable file (.xlsx, .xls) to import your schedule and start tracking attendance.
          </Text>
        </View>

        <TouchableOpacity style={styles.uploadButton} onPress={pickDocument} disabled={importing}>
          <Upload size={32} color="#3B82F6" />
          <Text style={styles.uploadText}>Choose Excel File</Text>
          <Text style={styles.uploadSubtext}>
            Supports .xlsx, .xls, and CSV formats
          </Text>
        </TouchableOpacity>

        {selectedFile && (
          <View style={styles.selectedFile}>
            <FileSpreadsheet size={20} color="#059669" />
            <Text style={styles.selectedFileName}>{selectedFile}</Text>
          </View>
        )}

        {importing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Parsing Excel file...</Text>
          </View>
        )}

        {preview && !importing && (
          <View style={styles.previewContainer}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Import Preview</Text>
              <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(preview.metadata.confidence) }]}>
                {React.createElement(getConfidenceIcon(preview.metadata.confidence), { 
                  size: 14, 
                  color: 'white' 
                })}
                <Text style={styles.confidenceText}>
                  {preview.metadata.confidence.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{preview.sessions.length}</Text>
                <Text style={styles.statLabel}>Sessions Found</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {new Set(preview.sessions.map(s => s.subject_name)).size}
                </Text>
                <Text style={styles.statLabel}>Unique Subjects</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{preview.unparsedCells.length}</Text>
                <Text style={styles.statLabel}>Unparsed Cells</Text>
              </View>
            </View>

            {preview.unparsedCells.length > 0 && (
              <View style={styles.unparsedSection}>
                <Text style={styles.unparsedTitle}>
                  ⚠️ Cells that couldn't be parsed:
                </Text>
                {preview.unparsedCells.slice(0, 3).map((cell, index) => (
                  <View key={index} style={styles.unparsedItem}>
                    <Text style={styles.unparsedLocation}>
                      Row {cell.row}, Col {cell.col}:
                    </Text>
                    <Text style={styles.unparsedContent} numberOfLines={2}>
                      {cell.content}
                    </Text>
                  </View>
                ))}
                {preview.unparsedCells.length > 3 && (
                  <Text style={styles.unparsedMore}>
                    ... and {preview.unparsedCells.length - 3} more
                  </Text>
                )}
              </View>
            )}

            <TouchableOpacity 
              style={styles.confirmButton} 
              onPress={confirmImport}
              disabled={importing}
            >
              <Text style={styles.confirmText}>Import Timetable</Text>
              <ArrowRight size={18} color="white" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Excel Format Requirements</Text>
          <Text style={styles.helpText}>
            • Your Excel should have a "Time" column and weekday headers{'\n'}
            • Each session cell should contain: Subject (Type): (Room) Lecturer: (Groups){'\n'}
            • Multiple sessions per time slot should be on separate lines{'\n'}
            • Example: "Python for DataScience (P): (3102B-BL3-FF) Ms. R.Sujitha: (23CSBTB15,23CSBTB16)"{'\n'}
            • Mobile tip: If import fails, try saving the Excel file to your device first
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    marginBottom: 20,
  },
  uploadText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3B82F6',
    marginTop: 12,
  },
  uploadSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  selectedFileName: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#059669',
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  previewContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3B82F6',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  unparsedSection: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  unparsedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D97706',
    marginBottom: 12,
  },
  unparsedItem: {
    marginBottom: 8,
  },
  unparsedLocation: {
    fontSize: 12,
    fontWeight: '500',
    color: '#92400E',
  },
  unparsedContent: {
    fontSize: 12,
    color: '#451A03',
    marginTop: 2,
  },
  unparsedMore: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#92400E',
    marginTop: 8,
  },
  confirmButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  helpSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});