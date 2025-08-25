import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const pdfAuth = async (req, res, next) => {
  try {
    let token;
    
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in query parameter
    else if (req.query.token) {
      token = req.query.token;
    }
    
    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    // Use environment variable or fallback to a default secret
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key-for-development';
    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('PDF Auth Error:', error);
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
}; 