const express = require('express');
const router = express.Router();
const { getDB } = require('../Database/connection');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const { sendSignupEmail, sendLoginEmail } = require('../utils/email');

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

router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
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

    // Send welcome email
    try {
      await sendSignupEmail(email);
    } catch (emailError) {
      console.error('Failed to send signup email:', emailError);
      // Don't fail the signup if email fails
    }

    res.status(201).json({
      message: 'User created successfully',
      userId: result.insertedId,
    });
  } catch (error) {
    console.error('Sign up error:', error);
    res.status(500).json({ message: 'Server error during sign up' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Send login notification email
    try {
      await sendLoginEmail(email);
    } catch (emailError) {
      console.error('Failed to send login email:', emailError);
      // Don't fail the login if email fails
    }

    res.status(200).json({
      message: 'Login successful',
      userId: user._id,
      email: user.email,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

module.exports = router;
