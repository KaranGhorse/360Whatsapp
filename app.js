const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const { type } = require('os');
const UserModel = require('./adminModel');
const waModel = require('./waModel');
const whatsappRoute = require('./whatsapp')
const app = express();

// Secret key for JWT
const JWT_SECRET = 'your_secret_key';

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/authApp').then(() => console.log("Connected to MongoDB"))




// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Set up the view engine
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));


app.use('/',whatsappRoute)
// Authentication middleware
function authenticateToken(req, res, next) {
    const token = req.cookies["whatsapp-Dev"];
  
    if (!token || token === undefined) {
      return res.redirect("/login");
    }
  
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.log("token not decoded");
  
        return res.redirect("/login");
      }
  
      req.user = decoded;
      // console.log(req.user);
      return next();
    });
  }

// Route to render signup page
app.get('/signup', (req, res) => {
    res.render('signup');
});

// Route to handle signup logic
app.post('/signup', async (req, res) => {
    const { email,name, password } = req.body;
    console.log(req.body)

    try {
        // Check if the user already exists
        const existingUser = await UserModel.findOne({ email });
        if (existingUser) {
            return res.render('signup', { error: 'Username already exists' });
        }

        // Create a new user and save it to the database
        const newUser = new UserModel({ email,name, password, });
        await newUser.save();
        const payload = {
            _id: newUser._id,
            name: newUser.name,
            email: newUser.email
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
            res.cookie('whatsapp-Dev', token, { httpOnly: true }); // Send token in HTTP-only cookie
            res.redirect('/dashboard');
       // Redirect to login page after signup
    } catch (error) {
        console.error("Error in signup:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Route to render login page
app.get('/', (req, res) => {
    res.render('login');
});

// Login route to authenticateToken and send JWT token
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(req.body)
    try {
        // Find user by username and verify password
        const user = await UserModel.findOne({ email });
        console.log(user)
        if (user && user.password === password) { // Simple check for password; ideally, hash passwords
            // Generate JWT token
            const payload = {
                _id: user._id,
                name: user.name,
                email: user.email
            };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
            console.log(token)
            res.cookie('whatsapp-Dev', token, { httpOnly: true }); // Send token in HTTP-only cookie
            res.redirect('/dashboard');
        } else {
            res.render('login', { error: 'Invalid username or password' });
        }
    } catch (error) {
        console.error("Error in login:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Protected route to render the dashboard page
app.get('/dashboard', authenticateToken, async (req, res) => {
    console.log("dashBoard")
    let user = await UserModel.findOne({email : req.user.email})
    let wa = await waModel.findOne({cid: user._id})
    console.log(user,wa);
    
    res.render('dashboard', { user,wa});
});

// Logout route
app.get('/logout', (req, res) => {
    res.clearCookie('authToken'); // Clear the JWT cookie
    res.redirect('/'); // Redirect to login page
});



// Server setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
