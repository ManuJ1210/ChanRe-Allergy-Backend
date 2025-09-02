import AtopicDermatitis from '../models/AtopicDermatitis.js';

export const createAtopicDermatitis = async (req, res) => {
  try {
    const recordData = {
      ...req.body,
      updatedBy: req.user._id // Set the current user as the one who created/updated the record
    };
    const record = await AtopicDermatitis.create(recordData);
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ message: 'Error creating atopic dermatitis record', error: err.message });
  }
};

export const getAtopicDermatitisByPatient = async (req, res) => {
  try {
    const { patientId } = req.query;
    
    if (!patientId) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }

    const records = await AtopicDermatitis.find({ patientId })
      .populate('patientId', 'name age centerCode phone gender')
      .populate('updatedBy', 'name role')
      .sort({ createdAt: -1 });
    
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching atopic dermatitis records', error: err.message });
  }
};

export const getAtopicDermatitisById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await AtopicDermatitis.findById(id)
      .populate('patientId', 'name age centerCode phone gender')
      .populate('updatedBy', 'name role');
    
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }
    
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching atopic dermatitis record by ID', error: err.message });
  }
}; 