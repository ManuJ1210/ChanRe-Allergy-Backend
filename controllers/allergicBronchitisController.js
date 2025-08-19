import AllergicBronchitis from '../models/AllergicBronchitis.js';

export const createAllergicBronchitis = async (req, res) => {
  try {
    const record = await AllergicBronchitis.create(req.body);
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ message: 'Error creating allergic bronchitis record', error: err.message });
  }
};

export const getAllergicBronchitisByPatient = async (req, res) => {
  try {
    const { patientId } = req.query;
    
    if (!patientId) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }

    const records = await AllergicBronchitis.find({ patientId })
      .populate('patientId', 'name age centerCode phone gender')
      .sort({ createdAt: -1 });
    
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching allergic bronchitis records', error: err.message });
  }
};

export const getAllergicBronchitisById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await AllergicBronchitis.findById(id)
      .populate('patientId', 'name age centerCode phone gender');
    
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }
    
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching allergic bronchitis record by ID', error: err.message });
  }
}; 