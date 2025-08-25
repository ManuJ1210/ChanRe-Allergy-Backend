import AllergicConjunctivitis from '../models/AllergicConjunctivitis.js';

export const createAllergicConjunctivitis = async (req, res) => {
  try {
    const record = await AllergicConjunctivitis.create(req.body);
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ message: 'Error creating allergic conjunctivitis record', error: err.message });
  }
};

export const getAllergicConjunctivitisByPatient = async (req, res) => {
  try {
    const { patientId } = req.query;
    
    if (!patientId) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }

    const records = await AllergicConjunctivitis.find({ patientId })
      .populate('patientId', 'name age centerCode phone gender')
      .sort({ createdAt: -1 });
    
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching allergic conjunctivitis records', error: err.message });
  }
};

export const getAllergicConjunctivitisById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await AllergicConjunctivitis.findById(id)
      .populate('patientId', 'name age centerCode phone gender');
    
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }
    
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching allergic conjunctivitis record by ID', error: err.message });
  }
}; 