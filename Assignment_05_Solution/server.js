/*********************************************************************************
 * BTI325 – Assignment 05
 * I declare that this assignment is my own work in accordance with Seneca Academic Policy. 
 * No part of this assignment has been copied manually or electronically from any other source 
 * (including 3rd party web sites) or distributed to other students.
 *
 * Name: NANA KOFI AGYEMAN-PREMPEH Student ID: 152656237 Date: November 29 2024
 *
 * Online (Vercel) Link:https://vercel.com/nkprempehs-projects/assignmentt5/E45SvkXFgcBRzsT4SNAHXZWCQYZp

 ********************************************************************************/

const express = require('express');
const blogData = require("./blog-service");
const multer = require("multer");
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const exphbs = require("express-handlebars");
const path = require("path");
const stripJs = require('strip-js');
const clientSessions = require('client-sessions');
const authData = require('./auth-service'); // Require auth-service.js for user registration and login

const app = express();
const featureImage='https://res.cloudinary.com/dvb5q5g34/image/upload/v1730510671/samples/man-portrait.jpg';
const HTTP_PORT = process.env.PORT || 8080;

cloudinary.config({
    cloud_name: 'dvb5q5g34',
    api_key: '569391134771446',
    api_secret: 'ANIqgXcbADAgDheg9rFWIqgOVAA',
    secure: true
});

const upload = multer();

// Handlebars setup
app.engine(".hbs", exphbs.engine({
    extname: ".hbs",
    helpers: {
        navLink: function(url, options){
            return '<li' + 
                ((url == app.locals.activeRoute) ? ' class="active" ' : '') + 
                '><a href="' + url + '">' + options.fn(this) + '</a></li>';
        },
        equal: function (lvalue, rvalue, options) {
            if (arguments.length < 3)
                throw new Error("Handlebars Helper equal needs 2 parameters");
            if (lvalue != rvalue) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        },
        safeHTML: function(context){
            return stripJs(context);
        },
        formatDate: function(dateObj){
            let year = dateObj.getFullYear();
            let month = (dateObj.getMonth() + 1).toString();
            let day = dateObj.getDate().toString();
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2,'0')}`;
        }
    }
}));

app.set('view engine', '.hbs');

app.use(express.static('public'));
app.use(express.urlencoded({extended: true}));

// Middleware for handling sessions
app.use(clientSessions({
    cookieName: "session",
    secret: "aRandomSecretString", 
    duration: 2 * 60 * 1000, 
    activeDuration: 1000 * 60 
}));
app.get('/blog', async (req, res) => {
    let viewData = {};

    try {
        // Fetch posts from the database
        let posts = [];
        if (req.query.category) {
            posts = await blogData.getPublishedPostsByCategory(req.query.category); // Filter by category if provided
        } else {
            posts = await blogData.getPublishedPosts(); // Fetch all posts
        }

        // Sort posts by date in descending order
        posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));

        // Get the latest post (the first post in the sorted array)
        let post = posts[0];

        // Add posts and the latest post to the view data
        viewData.posts = posts;
        viewData.post = post;
    } catch (err) {
        viewData.message = "No posts found";
    }

    try {
        // Fetch categories
        let categories = await blogData.getCategories();
        viewData.categories = categories;
    } catch (err) {
        viewData.categoriesMessage = "No categories found";
    }

    // Render the blog view with the data
    res.render("blog", { data: viewData });
});


// Middleware to pass session data to views
app.use(function(req, res, next){
    res.locals.session = req.session;
    next();
});

// Ensure user is logged in middleware
function ensureLogin(req, res, next) {
    if (!req.session.user) {
        res.redirect("/login");
    } else {
        next();
    }
}

// Routes
app.get('/', (req, res) => {
    res.redirect("/blog");
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    authData.registerUser(req.body)
        .then(() => {
            res.render('register', { successMessage: "User created" });
        })
        .catch(err => {
            res.render('register', { errorMessage: err, userName: req.body.userName });
        });
});

app.post('/login', (req, res) => {
    req.body.userAgent = req.get('User-Agent');
    authData.checkUser(req.body)
        .then((user) => {
            req.session.user = {
                userName: user.userName,
                email: user.email,
                loginHistory: user.loginHistory
            };
            res.redirect('/userHistory');
        })
        .catch(err => {
            res.render('login', { errorMessage: err, userName: req.body.userName });
        });
});

app.get('/logout', (req, res) => {
    req.session.reset();
    res.redirect('/blog');
});

app.get('/userHistory', ensureLogin, (req, res) => {
    res.render('userHistory', { user: req.session.user });
});

// Blog routes and other routes can remain as they are in the original `server.js`.
app.post('/posts/add', upload.single('featureImage'), (req, res) => {
    if (req.file) {
        // Upload image to Cloudinary
        let streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                let stream = cloudinary.uploader.upload_stream(
                    (error, result) => {
                        if (result) {
                            resolve(result); // Resolve with Cloudinary result (including URL)
                        } else {
                            reject(error); // Reject if there's an error
                        }
                    }
                );
                // Stream the file buffer to Cloudinary
                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });
        };

        async function upload(req) {
            let result = await streamUpload(req); // Wait for Cloudinary upload to finish
            processPost(result.url); // Get the URL of the uploaded image
        }

        upload(req).then(() => {
            res.redirect("/posts"); // After successful post creation, redirect to the posts page
        }).catch((err) => {
            res.status(500).send(err); // Handle errors during image upload
        });
    } else {
        // If no file is uploaded, proceed with post creation without the image
        processPost("");
    }});

    authData.initialize().then(() => {
        // Routes that use the User model
        app.post('/register', (req, res) => {
            authData.registerUser(req.body)
                .then(() => {
                    res.render('register', { successMessage: "User created" });
                })
                .catch(err => {
                    res.render('register', { errorMessage: err, userName: req.body.userName });
                });
        });















    




    

    
    app.get('/blog', async (req, res) => {

        // Declare an object to store properties for the view
        let viewData = {};
    
        try{
    
            // declare empty array to hold "post" objects
            let posts = [];
    
            // if there's a "category" query, filter the returned posts by category
            if(req.query.category){
                // Obtain the published "posts" by category
                posts = await blogData.getPublishedPostsByCategory(req.query.category);
            }else{
                // Obtain the published "posts"
                posts = await blogData.getPublishedPosts();
            }
    
            // sort the published posts by postDate
            posts.sort((a,b) => new Date(b.postDate) - new Date(a.postDate));
    
            // get the latest post from the front of the list (element 0)
            let post = posts[0]; 
    
            // store the "posts" and "post" data in the viewData object (to be passed to the view)
            viewData.posts = posts;
            viewData.post = post;
    
        }catch(err){
            viewData.message = "no results";
        }
    
        try{
            // Obtain the full list of "categories"
            let categories = await blogData.getCategories();
    
            // store the "categories" data in the viewData object (to be passed to the view)
            viewData.categories = categories;
        }catch(err){
            viewData.categoriesMessage = "no results"}
            // render the "blog" view with all of the data (viewData)
    res.render("blog", {data: viewData})

});
    // Function to process the post data and save to the database
    function processPost(imageUrl) {
        req.body.featureImage = imageUrl; // Add the Cloudinary image URL to the post data

        // Save the post to the database, including the image URL
        blogData.addPost(req.body).then(post => {
            res.redirect("/posts"); // Redirect to posts after saving
        }).catch(err => {
            res.status(500).send("Error creating post: " + err); // Handle errors during post creation
        });
    }
});

app.post("/posts/add", upload.single("featureImage"), (req,res)=>{

    if(req.file){
        let streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                let stream = cloudinary.uploader.upload_stream(
                    (error, result) => {
                        if (result) {
                            resolve(result);
                        } else {
                            reject(error);
                        }
                    }
                );
    
                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });
        };
    
        async function upload(req) {
            let result = await streamUpload(req);
            console.log(result);
            return result;
        }
    
        upload(req).then((uploaded)=>{
            processPost(uploaded.url);
        });
    }else{
        processPost("");
    }   

    function processPost(imageUrl){
        req.body.featureImage = imageUrl;

        blogData.addPost(req.body).then(post=>{
            res.redirect("/posts");
        }).catch(err=>{
            res.status(500).send(err);
        })
    }   
});

app.get('/posts/add', (req, res) => {
    blogData.getCategories().then((data)=>{
        res.render("addPost", {categories: data});
     }).catch((err) => {
       // set category list to empty array
       res.render("addPost", {categories: [] });
    });
});

app.get("/posts/delete/:id", (req,res)=>{
    blogData.deletePostById(req.params.id).then(()=>{
      res.redirect("/posts");
    }).catch((err)=>{
      res.status(500).send("Unable to Remove Post / Post Not Found");
    });
});

app.get('/post/:id', (req,res)=>{
    blogData.getPostById(req.params.id).then(data=>{
        res.json(data);
    }).catch(err=>{
        res.json({message: err});
    });
});

app.get('/blog/:id', async (req, res) => {

    // Declare an object to store properties for the view
    let viewData = {};

    try{

        // declare empty array to hold "post" objects
        let posts = [];

        // if there's a "category" query, filter the returned posts by category
        if(req.query.category){
            // Obtain the published "posts" by category
            posts = await blogData.getPublishedPostsByCategory(req.query.category);
        }else{
            // Obtain the published "posts"
            posts = await blogData.getPublishedPosts();
        }

        // sort the published posts by postDate
        posts.sort((a,b) => new Date(b.postDate) - new Date(a.postDate));

        // store the "posts" and "post" data in the viewData object (to be passed to the view)
        viewData.posts = posts;

    }catch(err){
        viewData.message = "no results";
    }

    try{
        // Obtain the post by "id"
        viewData.post = await blogData.getPostById(req.params.id);
    }catch(err){
        viewData.message = "no results"; 
    }

    try{
        // Obtain the full list of "categories"
        let categories = await blogData.getCategories();

        // store the "categories" data in the viewData object (to be passed to the view)
        viewData.categories = categories;
    }catch(err){
        viewData.categoriesMessage = "no results"
    }

    // render the "blog" view with all of the data (viewData)
    res.render("blog", {data: viewData})
});

app.get('/categories', (req, res) => {
    blogData.getCategories().then((data => {
        (data.length > 0) ? res.render("categories", {categories: data}) : res.render("categories",{ message: "no results" });
    })).catch(err => {
        res.render("categories", {message: "no results"});
    });
});

app.get('/categories/add', (req, res) => {
    res.render("addCategory");
});

app.post('/categories/add', (req,res)=>{
    blogData.addCategory(req.body).then(category=>{
        res.redirect("/categories");
    }).catch(err=>{
        res.status(500).send(err.message);
    })
});

app.get("/categories/delete/:id", (req,res)=>{
    blogData.deleteCategoryById(req.params.id).then(()=>{
      res.redirect("/categories");
    }).catch((err)=>{
      res.status(500).send("Unable to Remove Category / Category Not Found");
    });
});

app.use((req, res) => {
    res.status(404).render("404");
})


app.use(function(req,res,next){
    let route = req.path.substring(1);
    app.locals.activeRoute = "/" + (isNaN(route.split('/')[1]) ? route.replace(/\/(?!.*)/, "") : route.replace(/\/(.*)/, ""));    
    app.locals.viewingCategory = req.query.category;
    next();
});

// Start server with blogData initialization
blogData.initialize().then(() => {
    app.listen(HTTP_PORT, () => {
        console.log('server listening on: ' + HTTP_PORT);
    });
}).catch((err) => {
    console.log(err);
});
