const express = require('express');
const router = express.Router();
const { getDB } = require('../Database/connection');
const bcrypt = require('bcryptjs');
const validator = require('validator');

// GET - Info about signup endpoint
router.get('/signup', (req, res) => {
  res.json({
    message: 'Sign up endpoint',
    method: 'POST',
    endpoint: '/api/signup',
    body: {
      email: 'user@example.com',
      password: 'password123'
    }
  });
});

// POST - Sign up a new user
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      email,
      password: hashedPassword,
      createdAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);

    res.status(201).json({
      message: 'User created successfully',
      userId: result.insertedId,
    });
  } catch (error) {
    console.error('Sign up error:', error);
    res.status(500).json({ message: 'Server error during sign up' });
  }
});

module.exports = router;
