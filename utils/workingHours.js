// Working hours utility functions

/**
 * Check if current time is within working hours (7 AM - 8 PM)
 * @returns {boolean} True if within working hours
 */
export const isWithinWorkingHours = () => {
  const now = new Date();
  const currentHour = now.getHours();
  
  // Working hours: 7 AM (7) to 8 PM (20)
  return currentHour >= 7 && currentHour < 20;
};

/**
 * Check if a patient assignment is within working hours
 * @param {Date} assignmentDate - Date when patient was assigned
 * @returns {boolean} True if assignment was within working hours
 */
export const wasAssignedWithinWorkingHours = (assignmentDate) => {
  if (!assignmentDate) return false;
  
  const assignment = new Date(assignmentDate);
  const assignmentHour = assignment.getHours();
  
  // Working hours: 7 AM (7) to 8 PM (20)
  return assignmentHour >= 7 && assignmentHour < 20;
};

/**
 * Check if a patient has violated working hours
 * @param {Object} patient - Patient object
 * @returns {Object} Violation status and details
 */
export const checkWorkingHoursViolation = (patient) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Check if patient was assigned today
  const assignedAt = patient.assignedAt ? new Date(patient.assignedAt) : null;
  const assignedToday = assignedAt ? 
    assignedAt.getDate() === today.getDate() && 
    assignedAt.getMonth() === today.getMonth() && 
    assignedAt.getFullYear() === today.getFullYear() : false;
  
  if (!assignedToday) {
    return {
      hasViolation: false,
      reason: 'Not assigned today'
    };
  }
  
  // Check if patient was viewed by doctor
  if (patient.viewedByDoctor) {
    return {
      hasViolation: false,
      reason: 'Already viewed by doctor'
    };
  }
  
  // Check if current time is past working hours (8 PM)
  const currentHour = now.getHours();
  const isPastWorkingHours = currentHour >= 20;
  
  if (isPastWorkingHours) {
    return {
      hasViolation: true,
      reason: 'Working hours ended (8 PM) and patient not viewed',
      violationTime: now,
      assignedTime: assignedAt
    };
  }
  
  return {
    hasViolation: false,
    reason: 'Still within working hours'
  };
};

/**
 * Get working hours status for display
 * @returns {Object} Working hours status
 */
export const getWorkingHoursStatus = () => {
  const now = new Date();
  const currentHour = now.getHours();
  const isWithinHours = isWithinWorkingHours();
  
  return {
    currentTime: now,
    currentHour,
    isWithinWorkingHours: isWithinHours,
    workingHoursStart: 7,
    workingHoursEnd: 20,
    status: isWithinHours ? 'open' : 'closed',
    message: isWithinHours ? 
      `Working hours: 7 AM - 8 PM (Current: ${now.toLocaleTimeString()})` :
      `Working hours ended at 8 PM (Current: ${now.toLocaleTimeString()})`
  };
};



