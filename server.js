var logger = require('morgan');
var cors = require('cors');
var express = require('express');

var errorhandler = require('errorhandler');
var dotenv = require('dotenv');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var path = require('path');


// Firebase Initiailize
// Requrie apis
// 
var clientHandler = require('./router.js');

var app = express();

//View Engine
app.set('views', path.join(__dirname, './dist'));
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

// Embed File server
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, './dist')));

dotenv.load();

app.use(session({
  secret: 'keyboard cat',
  proxy: true,
  resave: true,
  saveUninitialized: true
}));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));
app.use(bodyParser.json({ limit: '5mb' }));
app.use(cors());
app.use(cookieParser());

app.use(function (err, req, res, next) {
  if (err.name === 'StatusError') {
    res.send(err.status, err.message);
  } else {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next(err);
  }
});

if (process.env.NODE_ENV === 'development') {
  app.use(express.logger('dev'));
  app.use(errorhandler());
}

app.use('/*', clientHandler);

var port = process.env.PORT || 80;

var http = require('http').Server(app);
var io = require('socket.io')(http);
http.listen(port, function (err) {
  console.log('listening on port:' + port);
});

var webList = {};
var mobileList = {};

io.on('connection', function (clientSocket) {

  clientSocket.on('webConnected', function (lat, long, phoneNumber, selfNumber) {
    console.log(lat, long, phoneNumber, selfNumber);
    try {
      io.to(mobileList[phoneNumber].socketId).emit('locationUpdateFromWeb', { lat: lat, long: long, phone: selfNumber });
    } catch (ex) { }
  });

  clientSocket.on('mobileConnected', function (lat, long, phoneNumber) {
    console.log("MobileConnected ", phoneNumber);
    mobileList[phoneNumber] = { socketId: clientSocket.id, phoneNumber: phoneNumber };
    try {
      io.to(webList[phoneNumber].socketId).emit('locationUpdateFromMobile', { lat: lat, long: long });
    } catch (ex) { }
  });

  clientSocket.on("searchPhone", function (phoneNumber) {
    var message = "Web Searching" + phoneNumber;
    console.log(message);
    webList[phoneNumber] = { socketId: clientSocket.id, phoneNumber: phoneNumber };
    console.log(webList);
    console.log(mobileList);
    try {
      io.to(mobileList[phoneNumber].socketId).emit("searchPhone", phoneNumber);
    } catch (ex) {
      try {
        io.to(webList[phoneNumber].socketId).emit("declineConnection", phoneNumber);
      } catch (ex) { }
    }
  });

  clientSocket.on("mobileYes", function (phoneNumber) {
    console.log("MobileYes", phoneNumber);
    try {
      io.to(webList[phoneNumber].socketId).emit("acceptConnection", phoneNumber);
    } catch (ex) { }
  });

  clientSocket.on("mobileNo", function (phoneNumber) {
    console.log("MobileNo", phoneNumber);
    try {
      io.to(webList[phoneNumber].socketId).emit("declineConnection", phoneNumber);
    } catch (ex) { }
  });

  clientSocket.on("mobileOn", function (phoneNumber) {
    var message = "Phone " + phoneNumber + " was connected.";
    console.log(message);
    mobileList[phoneNumber] = { socketId: clientSocket.id, phoneNumber: phoneNumber };
  });

});
