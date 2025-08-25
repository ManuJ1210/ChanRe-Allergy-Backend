import Medication from '../models/Medication.js';

export const createMedication = async (req, res) => {
  try {
    const { 
      patientId, 
      drugName, 
      dose, 
      duration, 
      frequency,
      prescribedBy,
      prescribedDate,
      instructions,
      adverseEvent 
    } = req.body;
    
    if (!patientId || !drugName || !dose || !duration) {
      return res.status(400).json({ message: 'All required fields must be provided.' });
    }
    
    const medication = await Medication.create({ 
      patientId, 
      drugName, 
      dose, 
      duration, 
      frequency,
      prescribedBy,
      prescribedDate,
      instructions,
      adverseEvent 
    });
    
    res.status(201).json({ message: 'Medication added successfully', data: medication });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add medication', error: err.message });
  }
};

// GET /api/medications?patientId=... - fetch all medications for a patient
export const getMedicationsByPatient = async (req, res) => {
  try {
    const { patientId } = req.query;
    if (!patientId) {
      return res.status(400).json({ message: 'patientId is required' });
    }
    const medications = await Medication.find({ patientId });
    res.status(200).json(medications);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch medications', error: err.message });
  }
}; 