import { format, differenceInDays } from 'date-fns';

export const formatDate = (date: string) => format(new Date(date), 'dd MMM yyyy');

export const calculatePercentage = (present: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((present / total) * 100 * 10) / 10;
};

export const getAttendanceColor = (percentage: number): string => {
  if (percentage >= 75) return '#22c55e'; // green
  if (percentage >= 60) return '#f59e0b'; // yellow
  return '#ef4444'; // red
};

export const generatePIN = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

export const extractSubnet = (ip: string): string => {
  return ip.split('.').slice(0, 3).join('.');
};
