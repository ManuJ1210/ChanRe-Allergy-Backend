import LabStaff from '../models/LabStaff.js';
import bcrypt from 'bcryptjs';

// Get all lab staff
export const getAllLabStaff = async (req, res) => {
  try {
    const labStaff = await LabStaff.find({ isActive: true })
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.status(200).json(labStaff);
  } catch (error) {
    console.error('Error fetching lab staff:', error);
    res.status(500).json({ message: 'Failed to fetch lab staff' });
  }
};

// Get lab staff by ID
export const getLabStaffById = async (req, res) => {
  try {
    const { id } = req.params;
    const labStaff = await LabStaff.findById(id).select('-password');
    
    if (!labStaff) {
      return res.status(404).json({ message: 'Lab staff not found' });
    }
    
    res.status(200).json(labStaff);
  } catch (error) {
    console.error('Error fetching lab staff by ID:', error);
    res.status(500).json({ message: 'Failed to fetch lab staff' });
  }
};

// Create new lab staff
export const createLabStaff = async (req, res) => {
  try {
    const {
      staffName,
      email,
      phone,
      role,
      password
    } = req.body;

    // Check if email already exists
    const existingStaff = await LabStaff.findOne({ email });
    if (existingStaff) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new lab staff
    const newLabStaff = new LabStaff({
      staffName,
      email,
      phone,
      role: role || 'Lab Staff',
      password: hashedPassword
    });

    const savedLabStaff = await newLabStaff.save();
    
    // Return lab staff without password
    const { password: _, ...labStaffWithoutPassword } = savedLabStaff.toObject();
    
    res.status(201).json({
      message: 'Lab staff created successfully',
      labStaff: labStaffWithoutPassword
    });
  } catch (error) {
    console.error('Error creating lab staff:', error);
    res.status(500).json({ message: 'Failed to create lab staff' });
  }
};

// Update lab staff
export const updateLabStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // If password is being updated, hash it
    if (updateData.password) {
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(updateData.password, saltRounds);
    }

    const updatedLabStaff = await LabStaff.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedLabStaff) {
      return res.status(404).json({ message: 'Lab staff not found' });
    }

    res.status(200).json({
      message: 'Lab staff updated successfully',
      labStaff: updatedLabStaff
    });
  } catch (error) {
    console.error('Error updating lab staff:', error);
    res.status(500).json({ message: 'Failed to update lab staff' });
  }
};

// Delete lab staff (soft delete)
export const deleteLabStaff = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedLabStaff = await LabStaff.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!deletedLabStaff) {
      return res.status(404).json({ message: 'Lab staff not found' });
    }

    res.status(200).json({
      message: 'Lab staff deleted successfully',
      labStaff: deletedLabStaff
    });
  } catch (error) {
    console.error('Error deleting lab staff:', error);
    res.status(500).json({ message: 'Failed to delete lab staff' });
  }
};

// Get lab staff by lab ID (for centralized lab)
export const getLabStaffByLabId = async (req, res) => {
  try {
    const { labId } = req.params;
    
    const labStaff = await LabStaff.find({ 
      labId, 
      isActive: true 
    }).select('-password').sort({ createdAt: -1 });

    res.status(200).json(labStaff);
  } catch (error) {
    console.error('Error fetching lab staff by lab ID:', error);
    res.status(500).json({ message: 'Failed to fetch lab staff' });
  }
}; 