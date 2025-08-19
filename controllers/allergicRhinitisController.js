import AllergicRhinitis from '../models/AllergicRhinitis.js';

export const createAllergicRhinitis = async (req, res) => {
  try {
    const record = await AllergicRhinitis.create(req.body);
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ message: 'Error creating allergic rhinitis record', error: err.message });
  }
};

export const getAllergicRhinitisByPatient = async (req, res) => {
  try {
    const { patientId } = req.query;
    
    if (!patientId) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }

    const records = await AllergicRhinitis.find({ patientId })
      .populate('patientId', 'name age centerCode phone gender')
      .sort({ createdAt: -1 });
    
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching allergic rhinitis records', error: err.message });
  }
};

export const getAllergicRhinitisById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await AllergicRhinitis.findById(id)
      .populate('patientId', 'name age centerCode phone gender');
    
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }
    
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching allergic rhinitis record by ID', error: err.message });
  }
}; 