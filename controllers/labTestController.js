import LabTest from '../models/LabTest.js';

// Get all active lab tests with optional search and pagination
export const getAllLabTests = async (req, res) => {
  try {
    const { 
      search = '', 
      category = '', 
      page = 1, 
      limit = 100,
      sortBy = 'testName',
      sortOrder = 'asc'
    } = req.query;

    // Build query
    const query = { isActive: true };

    // Add search filter
    if (search) {
      query.$or = [
        { testName: { $regex: search, $options: 'i' } },
        { testCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Add category filter
    if (category) {
      query.category = category;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Execute query
    const [tests, total] = await Promise.all([
      LabTest.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      LabTest.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: tests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching lab tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lab tests',
      error: error.message
    });
  }
};

// Get lab test by ID
export const getLabTestById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const test = await LabTest.findById(id);
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Lab test not found'
      });
    }

    res.status(200).json({
      success: true,
      data: test
    });
  } catch (error) {
    console.error('Error fetching lab test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lab test',
      error: error.message
    });
  }
};

// Get lab test by code
export const getLabTestByCode = async (req, res) => {
  try {
    const { code } = req.params;
    
    const test = await LabTest.findOne({ 
      testCode: code.toUpperCase(), 
      isActive: true 
    });
    
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Lab test not found'
      });
    }

    res.status(200).json({
      success: true,
      data: test
    });
  } catch (error) {
    console.error('Error fetching lab test by code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lab test',
      error: error.message
    });
  }
};

// Get all test categories
export const getTestCategories = async (req, res) => {
  try {
    const categories = await LabTest.distinct('category', { isActive: true });
    
    res.status(200).json({
      success: true,
      data: categories.sort()
    });
  } catch (error) {
    console.error('Error fetching test categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test categories',
      error: error.message
    });
  }
};

// Search tests (optimized for typeahead/autocomplete)
export const searchLabTests = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    let tests;
    
    if (!q || q.length < 2) {
      // If no search query, return first 20 tests
      tests = await LabTest.find({ isActive: true })
        .select('testCode testName cost category')
        .sort({ testName: 1 })
        .limit(parseInt(limit))
        .lean();
    } else {
      // Search by test name or code
      tests = await LabTest.find({
        isActive: true,
        $or: [
          { testName: { $regex: q, $options: 'i' } },
          { testCode: { $regex: q, $options: 'i' } }
        ]
      })
        .select('testCode testName cost category')
        .limit(parseInt(limit))
        .lean();
    }

    res.status(200).json({
      success: true,
      data: tests
    });
  } catch (error) {
    console.error('Error searching lab tests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search lab tests',
      error: error.message
    });
  }
};

// Get test statistics
export const getTestStatistics = async (req, res) => {
  try {
    const [totalTests, categories, costStats] = await Promise.all([
      LabTest.countDocuments({ isActive: true }),
      LabTest.distinct('category', { isActive: true }),
      LabTest.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            avgCost: { $avg: '$cost' },
            minCost: { $min: '$cost' },
            maxCost: { $max: '$cost' }
          }
        }
      ])
    ]);

    const categoryCount = await LabTest.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalTests,
        totalCategories: categories.length,
        categories: categoryCount,
        costStatistics: costStats[0] || {
          avgCost: 0,
          minCost: 0,
          maxCost: 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching test statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch test statistics',
      error: error.message
    });
  }
};

// Create a new lab test (Admin only)
export const createLabTest = async (req, res) => {
  try {
    const testData = req.body;
    
    // Check if test code already exists
    const existingTest = await LabTest.findOne({ 
      testCode: testData.testCode.toUpperCase() 
    });
    
    if (existingTest) {
      return res.status(400).json({
        success: false,
        message: 'A test with this code already exists'
      });
    }

    const newTest = await LabTest.create(testData);
    
    res.status(201).json({
      success: true,
      message: 'Lab test created successfully',
      data: newTest
    });
  } catch (error) {
    console.error('Error creating lab test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create lab test',
      error: error.message
    });
  }
};

// Update lab test (Admin only)
export const updateLabTest = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const updatedTest = await LabTest.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!updatedTest) {
      return res.status(404).json({
        success: false,
        message: 'Lab test not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Lab test updated successfully',
      data: updatedTest
    });
  } catch (error) {
    console.error('Error updating lab test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update lab test',
      error: error.message
    });
  }
};

// Deactivate lab test (Admin only)
export const deactivateLabTest = async (req, res) => {
  try {
    const { id } = req.params;
    
    const updatedTest = await LabTest.findByIdAndUpdate(
      id,
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );
    
    if (!updatedTest) {
      return res.status(404).json({
        success: false,
        message: 'Lab test not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Lab test deactivated successfully',
      data: updatedTest
    });
  } catch (error) {
    console.error('Error deactivating lab test:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate lab test',
      error: error.message
    });
  }
};

