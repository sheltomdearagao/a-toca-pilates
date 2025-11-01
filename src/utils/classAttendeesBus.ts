import type { ClassAttendee } from '@/types/schedule';
 
export const AttendeesBus = {
  listeners: [] as Array<(attendees: ClassAttendee[]) => void>,
  emit(attendees: ClassAttendee[]) {
    this.listeners.forEach((l) => l(attendees));
  },
  subscribe(listener: (attendees: ClassAttendee[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  },
};