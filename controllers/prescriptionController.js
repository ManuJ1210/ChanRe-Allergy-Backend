import Prescription from '../models/Prescription.js';

export const createPrescription = async (req, res) => {
  try {
    console.log('Prescription create request body:', req.body);
    const { 
      patientId, 
      doctorId, 
      centerId, 
      visit, 
      date, 
      diagnosis, 
      medications, 
      instructions, 
      followUp 
    } = req.body;
    const updatedBy = req.user._id;
    if (!patientId) {
      return res.status(400).json({ message: 'patientId is required' });
    }
    const record = await Prescription.create({ 
      patientId, 
      doctorId, 
      centerId, 
      visit, 
      date, 
      diagnosis, 
      medications, 
      instructions, 
      followUp, 
      updatedBy 
    });
    res.status(201).json({ message: 'Prescription added', data: record });
  } catch (err) {
    console.error('Failed to add prescription:', err);
    res.status(500).json({ message: 'Failed to add prescription', error: err.message });
  }
};

export const getPrescriptionsByPatient = async (req, res) => {
  try {
    // Support both query parameter (?patientId=xxx) and path parameter (/patient/:patientId)
    const patientId = req.params.patientId || req.query.patientId;
    console.log('getPrescriptionsByPatient called with patientId:', patientId);
    console.log('Request params:', req.params);
    console.log('Request query:', req.query);
    
    let records;
    if (patientId && patientId !== 'undefined') {
      records = await Prescription.find({ patientId })
        .populate('patientId', 'name age centerCode phone')
        .populate('doctorId', 'name')
        .populate('centerId', 'name')
        .populate('updatedBy', 'name')
        .sort({ createdAt: -1 });
      console.log(`Found ${records.length} prescriptions for patientId: ${patientId}`);
    } else {
      console.log('No valid patientId provided, returning empty array');
      records = [];
    }
    
    res.status(200).json(records);
  } catch (err) {
    console.error('Error in getPrescriptionsByPatient:', err);
    res.status(500).json({ message: 'Failed to fetch prescriptions', error: err.message });
  }
};

export const getPrescriptionById = async (req, res) => {
  try {
    const record = await Prescription.findById(req.params.id)
      .populate('patientId', 'name age centerCode phone')
      .populate('doctorId', 'name')
      .populate('centerId', 'name')
      .populate('updatedBy', 'name');
    if (!record) {
      return res.status(404).json({ message: 'Not found' });
    }
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch prescription', error: err.message });
  }
};

export const deletePrescription = async (req, res) => {
  try {
    const record = await Prescription.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Prescription not found' });
    }
    
    await Prescription.findByIdAndDelete(req.params.id);
    res.json({ message: 'Prescription deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete prescription', error: err.message });
  }
}; 