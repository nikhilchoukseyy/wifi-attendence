import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        setIsOnline(state.isInternetReachable ?? true);
      } catch (err) {
        console.error('Error checking network:', err);
      }
    };

    checkNetwork();

    // Check every 10 seconds
    const interval = setInterval(checkNetwork, 10000);

    return () => clearInterval(interval);
  }, []);

  return { isOnline };
};

export const handleSupabaseError = (error: any): string => {
  if (!error) return 'An unknown error occurred';

  // Network errors
  if (error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
    return 'Network connection error. Please check your internet connection.';
  }

  // Authentication errors
  if (error.code === 'PGRST301') {
    return 'You are not authenticated. Please log in again.';
  }

  // Permission errors
  if (error.code === 'PGRST403') {
    return 'You do not have permission to perform this action.';
  }

  // Not found errors
  if (error.code === 'PGRST116') {
    return 'Record not found.';
  }

  // Unique constraint violations
  if (error.code === '23505') {
    return 'This record already exists.';
  }

  // Foreign key violations
  if (error.code === '23503') {
    return 'Referenced record does not exist.';
  }

  // Default error message
  return error.message || 'Something went wrong. Please try again.';
};
