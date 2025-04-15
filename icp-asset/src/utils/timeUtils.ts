/**
 * Time utility functions for handling timestamps and time-related operations
 */

/**
 * Get the current Unix timestamp in seconds
 * @returns {number} Current timestamp in seconds
 */
export const getCurrentTimestamp = (): number => {
    return Math.floor(Date.now() / 1000);
};

/**
 * Check if a timestamp has already passed
 * @param {number} timestamp - The timestamp to check (in seconds)
 * @returns {boolean} True if the timestamp has passed
 */
export const isTimestampPassed = (timestamp: number): boolean => {
    const currentTime = getCurrentTimestamp();
    return currentTime > timestamp;
};

/**
 * Calculate time remaining from now until the target timestamp
 * @param {number} targetTimestamp - Target timestamp in seconds
 * @returns {Object} Object containing days, hours, minutes, seconds remaining
 */
export const getTimeRemaining = (targetTimestamp: number) => {
    const totalSeconds = Math.max(0, targetTimestamp - getCurrentTimestamp());

    const days = Math.floor(totalSeconds / (60 * 60 * 24));
    const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    return {
        days,
        hours,
        minutes,
        seconds,
        totalSeconds
    };
};

/**
 * Format a timestamp to local time string
 * @param {number} timestamp - Unix timestamp in seconds
 * @param {string} format - Optional format string
 * @returns {string} Formatted time string
 */
export const formatTimeToLocal = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
}; 