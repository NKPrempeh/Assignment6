const mongoose = require('mongoose');

let User; // To be defined on new connection

// Define the schema for the users collection
const userSchema = new mongoose.Schema({
    userName: { type: String, unique: true },
    password: String,
    email: String,
    loginHistory: [
        {
            dateTime: Date,
            userAgent: String
        }
    ]
});




// Initialize the MongoDB connection
module.exports.initialize = function () {
    return new Promise((resolve, reject) => {
        const db = mongoose.createConnection("mongodb://localhost:27017/KofiPrempeh"); // Update database name if necessary

        db.on('error', (err) => reject(err)); // Handle connection errors

        db.once('open', () => {
            User = db.model("users", userSchema); // Define the User model
            resolve(); // Connection successful
        });
    });
};

// Register a new user
module.exports.registerUser = function (userData) {
    return new Promise((resolve, reject) => {
        if (userData.password !== userData.password2) {
            reject("Passwords do not match");
        } else {
            let newUser = new User({
                userName: userData.userName,
                password: userData.password, // Password should be hashed before saving (see assignment Part B)
                email: userData.email,
                loginHistory: []
            });

            newUser.save()
                .then(() => resolve())
                .catch((err) => {
                    if (err.code === 11000) {
                        reject("User Name already taken");
                    } else {
                        reject("There was an error creating the user: " + err);
                    }
                });
        }
    });
};

// Authenticate and log in a user
module.exports.checkUser = function (userData) {
    return new Promise((resolve, reject) => {
        User.findOne({ userName: userData.userName })
            .then((user) => {
                if (!user) {
                    reject("Unable to find user: " + userData.userName);
                } else if (user.password !== userData.password) {
                    reject("Incorrect Password for user: " + userData.userName);
                } else {
                    // Update login history
                    user.loginHistory.push({
                        dateTime: new Date().toString(),
                        userAgent: userData.userAgent
                    });

                    user.save()
                        .then(() => resolve(user))
                        .catch((err) => reject("Error updating login history: " + err));
                }
            })
            .catch(() => reject("Unable to find user: " + userData.userName));
    });
};
