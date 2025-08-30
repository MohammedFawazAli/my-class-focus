import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import { ParsedCell, Session, ImportPreview } from '@/types';

export class ExcelParser {
  private static readonly DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  private static readonly TIME_PATTERNS = [
    /^(\d{1,2}):(\d{2})$/,
    /^(\d{1,2})\.(\d{2})$/,
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i,
    /^(\d{1,2})\s*(AM|PM)$/i
  ];

  static async parseExcelFile(fileUri: string): Promise<ImportPreview> {
    try {
      let arrayBuffer: ArrayBuffer;
      
      if (Platform.OS === 'web') {
        // Web implementation
        const response = await fetch(fileUri);
        arrayBuffer = await response.arrayBuffer();
      } else {
        // Mobile implementation - handle file system access
        try {
          // First try to read as base64 and convert
          const base64Data = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          // Convert base64 to ArrayBuffer
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          arrayBuffer = bytes.buffer;
        } catch (fsError) {
          // Fallback: try direct fetch if file is accessible via URI
          console.log('FileSystem read failed, trying fetch fallback:', fsError);
          const response = await fetch(fileUri);
          arrayBuffer = await response.arrayBuffer();
        }
      }
      
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = this.findTimetableSheet(workbook);
      
      if (!sheetName) {
        throw new Error('No timetable sheet found. Looking for headers containing "Time" and weekday names.');
      }

      const worksheet = workbook.Sheets[sheetName];
      return this.parseWorksheet(worksheet);
    } catch (error) {
      console.error('Excel parsing error:', error);
      
      // Provide more specific error messages for mobile
      if (Platform.OS !== 'web' && error instanceof Error) {
        if (error.message.includes('FileSystem')) {
          throw new Error('Unable to access the selected file. Please try selecting the file again or ensure it\'s saved locally.');
        }
        if (error.message.includes('fetch')) {
          throw new Error('File access error. Please ensure the file is accessible and try again.');
        }
      }
      
      throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static findTimetableSheet(workbook: XLSX.WorkBook): string | null {
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      
      // Look for header row with "Time" and weekday columns
      for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 10); row++) {
        let hasTime = false;
        let dayCount = 0;
        
        for (let col = range.s.c; col <= Math.min(range.e.c, range.s.c + 10); col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          
          if (cell && cell.v) {
            const cellText = cell.v.toString().toLowerCase().trim();
            
            if (cellText.includes('time')) {
              hasTime = true;
            }
            
            for (const day of this.DAYS) {
              if (cellText.includes(day.toLowerCase())) {
                dayCount++;
                break;
              }
            }
          }
        }
        
        if (hasTime && dayCount >= 3) {
          return sheetName;
        }
      }
    }
    
    return workbook.SheetNames[0]; // Fallback to first sheet
  }

  private static parseWorksheet(worksheet: XLSX.Worksheet): ImportPreview {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    const sessions: Session[] = [];
    const unparsedCells: { row: number; col: number; content: string }[] = [];
    
    // Find header row
    let headerRow = -1;
    let timeCol = -1;
    const dayCols: { [key: string]: number } = {};
    
    for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 10); row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        
        if (cell && cell.v) {
          const cellText = cell.v.toString().toLowerCase().trim();
          
          if (cellText.includes('time')) {
            headerRow = row;
            timeCol = col;
          }
          
          for (const day of this.DAYS) {
            if (cellText.includes(day.toLowerCase())) {
              dayCols[day] = col;
            }
          }
        }
      }
      
      if (headerRow !== -1 && Object.keys(dayCols).length >= 3) {
        break;
      }
    }

    if (headerRow === -1 || timeCol === -1) {
      throw new Error('Could not find timetable structure. Ensure your Excel has a "Time" column and weekday headers.');
    }

    // Parse time slots and sessions
    const timeslots: string[] = [];
    
    for (let row = headerRow + 1; row <= range.e.r; row++) {
      const timeCellAddress = XLSX.utils.encode_cell({ r: row, c: timeCol });
      const timeCell = worksheet[timeCellAddress];
      
      if (!timeCell || !timeCell.v) continue;
      
      const timeStr = this.normalizeTime(timeCell.v.toString());
      if (!timeStr) continue;
      
      timeslots.push(timeStr);
      
      // Parse sessions for each day
      for (const [day, dayCol] of Object.entries(dayCols)) {
        const sessionCellAddress = XLSX.utils.encode_cell({ r: row, c: dayCol });
        const sessionCell = worksheet[sessionCellAddress];
        
        if (!sessionCell || !sessionCell.v) continue;
        
        const cellContent = sessionCell.v.toString().trim();
        if (!cellContent) continue;
        
        try {
          const parsedSessions = this.parseSessionCell(cellContent, day, timeStr);
          sessions.push(...parsedSessions);
        } catch (error) {
          unparsedCells.push({
            row: row + 1,
            col: dayCol + 1,
            content: cellContent
          });
        }
      }
    }

    const totalCells = (range.e.r - headerRow) * Object.keys(dayCols).length;
    const parsedCells = totalCells - unparsedCells.length;
    const confidence = this.calculateConfidence(parsedCells, totalCells);

    return {
      sessions,
      unparsedCells,
      metadata: {
        totalCells,
        parsedCells,
        confidence
      }
    };
  }

  private static parseSessionCell(cellContent: string, day: string, startTime: string): Session[] {
    const sessions: Session[] = [];
    const lines = cellContent.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const parsed = this.parseSessionLine(line.trim());
      if (parsed) {
        sessions.push({
          id: uuidv4(),
          day,
          start_time: startTime,
          duration_slots: 1,
          subject_name: parsed.subject_name,
          session_type: parsed.session_type,
          room: parsed.room_or_code,
          lecturer: parsed.lecturer,
          groups: parsed.groups,
          notes: '',
          attendance_marked: null
        });
      }
    }
    
    return sessions;
  }

  private static parseSessionLine(line: string): ParsedCell | null {
    // Enhanced pattern matching for the screenshot format
    // Examples from screenshot:
    // "Python for DataScience (P): (3102B-BL3-FF) Ms. R.Sujitha: (23CSBTB15,23CSBTB16)"
    // "Disaster Management (L): (3113-BL3-FF) Dr. A. Sandeep Reddy: (23CSBTB04,23CSBTB05,23CSBTB06)"
    
    let subject_name = '';
    let session_type = '';
    let room_or_code = '';
    let lecturer = '';
    let groups: string[] = [];
    
    try {
      // Enhanced group extraction - handle multiple group formats
      const groupsMatch = line.match(/\(([^)]+)\)\s*$/);
      if (groupsMatch) {
        const groupsStr = groupsMatch[1];
        // Handle both comma and space-separated groups
        groups = groupsStr.split(/[,\s]+/).map(g => g.trim()).filter(g => g && g.length > 0);
        line = line.substring(0, line.lastIndexOf('(')).trim();
      }
      
      // Enhanced lecturer extraction - handle various formats
      const lecturerMatch = line.match(/:\s*([^:()]+?)(?:\s*:\s*)?$/);
      if (lecturerMatch) {
        lecturer = lecturerMatch[1].trim()
          .replace(/^(Dr\.|Mr\.|Ms\.|Prof\.)\s*/i, '$1 ') // Normalize titles
          .replace(/\s+/g, ' '); // Normalize whitespace
        line = line.substring(0, line.lastIndexOf(':')).trim();
      }
      
      // Enhanced room extraction - handle various room formats
      const roomMatch = line.match(/:\s*\(([^)]+)\)/);
      if (roomMatch) {
        room_or_code = roomMatch[1].trim()
          .replace(/^(Room\s*)?/i, '') // Remove "Room" prefix if present
          .replace(/\s+/g, ' '); // Normalize whitespace
        line = line.replace(/:\s*\([^)]+\)/, '').trim();
      }
      
      // Enhanced subject and type extraction
      const subjectMatch = line.match(/^(.+?)\s*(?:\(([PLTFpr]+)\))?\s*:?$/i);
      if (subjectMatch) {
        subject_name = subjectMatch[1].trim()
          .replace(/\s+/g, ' ') // Normalize whitespace
          .replace(/^(.*?)\s*$/, '$1'); // Trim and clean
        session_type = (subjectMatch[2] || '').toUpperCase();
      } else {
        // Fallback: treat entire remaining text as subject
        subject_name = line.replace(/:\s*$/, '').trim()
          .replace(/\s+/g, ' ');
      }
      
      if (!subject_name) {
        return null;
      }
      
      return {
        subject_name,
        session_type,
        room_or_code,
        lecturer,
        groups,
        raw_text: line,
        confidence: this.calculateLineConfidence(subject_name, session_type, room_or_code, lecturer, groups)
      };
    } catch (error) {
      console.warn('Failed to parse session line:', line.substring(0, 50) + '...', error);
      return null;
    }
  }

  private static normalizeTime(timeStr: string): string | null {
    const cleaned = timeStr.toString().trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\d:.\sAPM]/gi, ''); // Remove special characters except time-related ones
    
    for (const pattern of this.TIME_PATTERNS) {
      const match = cleaned.match(pattern);
      if (match) {
        let hours = parseInt(match[1]);
        const minutes = match[2] ? parseInt(match[2]) : 0;
        const ampm = match[3]?.toUpperCase();
        
        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }
    
    // Additional fallback for numeric-only times (e.g., "9" -> "09:00")
    const numericMatch = cleaned.match(/^(\d{1,2})$/);
    if (numericMatch) {
      const hours = parseInt(numericMatch[1]);
      if (hours >= 0 && hours <= 23) {
        return `${hours.toString().padStart(2, '0')}:00`;
      }
    }
    
    return null;
  }

  private static calculateLineConfidence(
    subject: string,
    type: string,
    room: string,
    lecturer: string,
    groups: string[]
  ): 'high' | 'medium' | 'low' {
    let score = 0;
    if (subject && subject.length > 3) score += 2;
    if (type) score += 1;
    if (room) score += 1;
    if (lecturer && lecturer.length > 3) score += 1;
    if (groups.length > 0) score += 1;
    
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  private static calculateConfidence(parsed: number, total: number): 'high' | 'medium' | 'low' {
    const ratio = parsed / Math.max(total, 1);
    if (ratio >= 0.8) return 'high';
    if (ratio >= 0.6) return 'medium';
    return 'low';
  }
}