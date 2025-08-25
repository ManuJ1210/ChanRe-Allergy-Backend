import Notification from '../models/Notification.js';
import TestRequest from '../models/TestRequest.js';

// Get notifications for a doctor
export const getDoctorNotifications = async (req, res) => {
  try {
    console.log('🔍 getDoctorNotifications called for user:', req.user.id);
    
    const notifications = await Notification.find({ 
      recipient: req.user.id 
    })
    .populate('sender', 'name email')
    .populate({
      path: 'data.patientId',
      select: 'name age gender phoneNumber email address'
    })
    .sort({ createdAt: -1 })
    .limit(50);

    console.log('✅ Found notifications:', notifications.length);

    res.json({
      notifications,
      unreadCount: notifications.filter(n => !n.read).length
    });
  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
};

// Mark notification as read
export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({ message: 'Error marking notification as read', error: error.message });
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Error marking all notifications as read', error: error.message });
  }
};

// Get feedback for a specific test request
export const getTestRequestFeedback = async (req, res) => {
  try {
    const { testRequestId } = req.params;
    
    const testRequest = await TestRequest.findById(testRequestId);
    
    if (!testRequest) {
      return res.status(404).json({ message: 'Test request not found' });
    }

    // Check if the doctor is authorized to view this test request
    if (testRequest.doctorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this test request' });
    }

    const feedback = testRequest.superadminReview;
    
    if (!feedback) {
      return res.status(404).json({ message: 'No feedback available for this test request' });
    }

    res.json({
      feedback,
      testRequest: {
        _id: testRequest._id,
        testType: testRequest.testType,
        patientName: testRequest.patientName,
        status: testRequest.status,
        createdAt: testRequest.createdAt,
        completedAt: testRequest.reportGeneratedDate
      }
    });
  } catch (error) {
    console.error('❌ Error fetching test request feedback:', error);
    res.status(500).json({ message: 'Error fetching feedback', error: error.message });
  }
};

// Get all test requests with feedback for a doctor
export const getDoctorTestRequestsWithFeedback = async (req, res) => {
  try {
    const testRequests = await TestRequest.find({
      doctorId: req.user.id,
      'superadminReview.status': 'reviewed'
    })
    .populate('patientId', 'name age gender')
    .sort({ 'superadminReview.reviewedAt': -1 });

    const feedbackData = testRequests.map(tr => ({
      _id: tr._id,
      testType: tr.testType,
      patientName: tr.patientName,
      patient: tr.patientId,
      status: tr.status,
      createdAt: tr.createdAt,
      completedAt: tr.reportGeneratedDate,
      feedback: tr.superadminReview
    }));

    res.json({
      testRequestsWithFeedback: feedbackData,
      count: feedbackData.length
    });
  } catch (error) {
    console.error('❌ Error fetching test requests with feedback:', error);
    res.status(500).json({ message: 'Error fetching test requests with feedback', error: error.message });
  }
};
