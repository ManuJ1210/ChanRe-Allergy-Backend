import FollowUp from '../models/FollowUp.js';
import Patient from '../models/Patient.js';

export const createFollowUp = async (req, res) => {
  try {
    const { patientId, type, notes } = req.body;
    const updatedBy = req.user._id;
    if (!patientId || !type) {
      return res.status(400).json({ message: 'patientId and type are required' });
    }
    const followUp = await FollowUp.create({ patientId, type, notes, updatedBy });
    res.status(201).json({ message: 'Follow up added', data: followUp });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add follow up', error: err.message });
  }
};

export const getFollowUpsByPatient = async (req, res) => {
  try {
    const { patientId } = req.query;
    if (!patientId) {
      return res.status(400).json({ message: 'patientId is required' });
    }
    const followUps = await FollowUp.find({ patientId })
      .populate('updatedBy', 'name')
      .populate('patientId', 'name age centerCode phone') // use phone, not contact
      .sort({ date: -1 });
    res.status(200).json(followUps);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch follow ups', error: err.message });
  }
};

// Superadmin: Get all patients with their follow-up types (conditions)
export const getAllPatientsWithFollowUps = async (req, res) => {
  try {
    // Get all patients
    const patients = await Patient.find().select('name centerCode createdAt centerId').populate('centerId', 'name');
    // Get all followups
    const followups = await FollowUp.find().select('patientId type date').sort({ date: -1 });
    
    // Map patientId to set of follow-up types and get latest date
    const patientFollowupMap = {};
    const patientLatestDateMap = {};
    
    followups.forEach(fu => {
      const pid = fu.patientId.toString();
      if (!patientFollowupMap[pid]) {
        patientFollowupMap[pid] = new Set();
        patientLatestDateMap[pid] = null;
      }
      patientFollowupMap[pid].add(fu.type);
      
      // Track the latest follow-up date
      if (!patientLatestDateMap[pid] || new Date(fu.date) > new Date(patientLatestDateMap[pid])) {
        patientLatestDateMap[pid] = fu.date;
      }
    });
    
    // Build result
    const result = patients.map(p => ({
      _id: p._id,
      name: p.name,
      centerCode: p.centerCode,
      centerName: p.centerId?.name || '',
      createdAt: p.createdAt,
      followUpTypes: Array.from(patientFollowupMap[p._id.toString()] || []),
      lastFollowUpDate: patientLatestDateMap[p._id.toString()] || null
    }));
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch patients with follow ups', error: err.message });
  }
};

// Superadmin: Get detailed follow-up data for all patients
export const getAllDetailedFollowUps = async (req, res) => {
  try {
    // Import the models we need for detailed follow-up data
    const AllergicRhinitis = (await import('../models/AllergicRhinitis.js')).default;
    const AllergicConjunctivitis = (await import('../models/AllergicConjunctivitis.js')).default;
    const AllergicBronchitis = (await import('../models/AllergicBronchitis.js')).default;
    const AtopicDermatitis = (await import('../models/AtopicDermatitis.js')).default;
    const GPE = (await import('../models/GPE.js')).default;

    // Get all detailed follow-up data with patient info
    const [rhinitisData, conjunctivitisData, bronchitisData, dermatitisData, gpeData] = await Promise.all([
      AllergicRhinitis.find().populate({
        path: 'patientId',
        select: 'name centerCode centerId',
        populate: {
          path: 'centerId',
          select: 'name'
        }
      }),
      AllergicConjunctivitis.find().populate({
        path: 'patientId',
        select: 'name centerCode centerId',
        populate: {
          path: 'centerId',
          select: 'name'
        }
      }),
      AllergicBronchitis.find().populate({
        path: 'patientId',
        select: 'name centerCode centerId',
        populate: {
          path: 'centerId',
          select: 'name'
        }
      }),
      AtopicDermatitis.find().populate({
        path: 'patientId',
        select: 'name centerCode centerId',
        populate: {
          path: 'centerId',
          select: 'name'
        }
      }),
      GPE.find().populate({
        path: 'patientId',
        select: 'name centerCode centerId',
        populate: {
          path: 'centerId',
          select: 'name'
        }
      })
    ]);

    // Combine all follow-up data
    const allFollowUps = [
      ...rhinitisData.map(item => ({ ...item.toObject(), type: 'Allergic Rhinitis' })),
      ...conjunctivitisData.map(item => ({ ...item.toObject(), type: 'Allergic Conjunctivitis' })),
      ...bronchitisData.map(item => ({ ...item.toObject(), type: 'Allergic Bronchitis' })),
      ...dermatitisData.map(item => ({ ...item.toObject(), type: 'Atopic Dermatitis' })),
      ...gpeData.map(item => ({ ...item.toObject(), type: 'GPE' }))
    ];

    // Sort by date (newest first)
    allFollowUps.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

    res.json(allFollowUps);
  } catch (err) {
    console.error('Error fetching detailed follow-ups:', err);
    res.status(500).json({ message: 'Failed to fetch detailed follow-ups', error: err.message });
  }
};

// Center Admin: Get all followups for the center admin's center
export const getFollowUpsByCenter = async (req, res) => {
  try {
    const centerId = req.user.centerId;
    
    if (!centerId) {
      return res.status(400).json({ message: 'Center ID not found for user' });
    }

    // First, get all patients for this center
    const patients = await Patient.find({ centerId }).select('_id');
    const patientIds = patients.map(patient => patient._id);

    // Then, get all followups for these patients
    const followUps = await FollowUp.find({ patientId: { $in: patientIds } })
      .populate('updatedBy', 'name')
      .populate('patientId', 'name age centerCode phone')
      .sort({ date: -1 });
    
    res.status(200).json(followUps);
  } catch (err) {
    console.error('Error fetching followups by center:', err);
    res.status(500).json({ message: 'Failed to fetch followups', error: err.message });
  }
}; 