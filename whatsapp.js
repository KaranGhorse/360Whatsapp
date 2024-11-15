const express = require("express");
const router = express.Router();
const cron = require("node-cron");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qr = require("qr-image");
const fs = require("fs");
const path = require("path");
const logIncollection = require("./adminModel");
const waModel = require("./waModel");
const jwt = require("jsonwebtoken");

// const logIncollection = require("../models/admin.model");
const JWT_SECRET = 'your_secret_key';
global.clients = {};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function removeSession(userId) {
  // Define the path to the session directory for the given userId
  const sessionPath = path.join(__dirname, "sessions", `session-${userId}`);

  // Check if the session directory exists
  if (fs.existsSync(sessionPath)) {
    try {
      // Remove the session directory recursively
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`Session for user ${userId} removed successfully.`);
    } catch (err) {
      console.error(`Error removing session for user ${userId}:`, err);
    }
  } else {
    console.log(`No session found for user ${userId}.`);
  }
}
function removeClientFromGlobalObj(userId) {
  if (global.clients[userId]) {
    console.log(`Client for user ${userId} already exists. Removing it...`);
    delete global.clients[userId];
  }
}
function createClient(userId) {
  const sessionPath = path.join(__dirname, "sessions", `session-${userId}`);
  console.log("Attempting to create client for:", sessionPath);
  // todo remove session from dir if exist
  removeSession(userId);
  //todo remove client from globle obj if exist
  removeClientFromGlobalObj(userId);

  // todo create new client and session file
  const client = new Client({
    puppeteer: {
      headless: true,
      ignoreHTTPSErrors: true,
      args: [
        "--ignore-certificate-errors",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
    },
    authStrategy: new LocalAuth({
      clientId: userId,
      dataPath: path.join(__dirname, "sessions"),
    }),
  });
  //todo client store in global obj
  try {
    
    global.clients[userId] = {
      IS_CONNECTED: false, // Whether the client is connected
      CONNECTED_PHONE: null, // Mobile number of the client
      QR_CODE_DATA: null, // QR code string or image data
      client: client, // Client object (could be a user or client instance)
    };
  } catch (error) {
    console.log("ERROR in create client when client created and initia")
  }
  return client;
}

// Endpoint to initialize a WhatsApp session for a user
router.get("/qr", authenticateToken, async (req, res) => {
  console.log("req to QR in /qr ");
  try {
    const user = await logIncollection.findById(req.user._id);
    const wa = await waModel.findOne({ cid: user._id });
    if (wa) {
      global.clients[user._id].IS_CONNECTED = true;
      return res.json({ msg: "success" });
      // removeSession(user._id)
    } else {
      try {
        removeSession(user._id.toString());
        const client = createClient(user._id.toString());
        setupClientEvents(client, user._id);
        client.initialize();
        global.clients = global.clients || {};
        global.clients[user._id.toString()].client = client;
        res.json({ msg: "success" });
      } catch (err) {
        console.log("Error in qr genrating ", err);
      }
    }
    // Ensure global.clients exists and store the client for this user
  } catch (error) {
    console.log(error);
  }
});

router.get("/ready", authenticateToken, async (req, res) => {
  console.warn("try to ready client when scan qr");
  try {
    if (global.clients[req.user._id]) {
    console.log(global.clients[req.user._id].IS_CONNECTED);
    if (global.clients[req.user._id].IS_CONNECTED) {
      let WA = await waModel.findOne({ cid: req.user._id });
      if (!WA) {
        let wa = new waModel({
          whatsappClientReady: true,
          isConnected: true,
          connectedPhoneNumber: global.clients[req.user._id].CONNECTED_PHONE,
          cid: req.user._id,
        });
        await wa.save();
        let client = global.clients[req.user._id].client
        setTimeout((client) => {
            hay(client)
        }, (7 * 60 * 60 * 1000));
      }
      console.warn("is connected true send whatsapp connected ");
      res.json({ isConnected: global.clients[req.user._id].IS_CONNECTED });
    }
 } else {
      console.warn("is connected false send whatsapp not connected ");
      res.json({ isConnected: false });
    }
  } catch (err) {
    console.log("error in /ready", err);
  }
});

router.get("/scan", authenticateToken, async (req, res) => {
  console.warn("render qr page only with qr null");
  res.render("qr", { qrCodeData: null });
});



router.get('/remark/add',authenticateToken, async (req,res)=>{
  res.render('remark');
})

router.post('/remark/add', authenticateToken, async ()=>{
  console.log("touch /remark/add");
  
  try {
    const userId = req.user._id;
    const {time, date} = req.body;
    console.log(req.body)
    const remarkDateTime = new Date(`${date}T${time}:00`);
    const currentTime = new Date();
  
    let timeDifference = remarkDateTime - currentTime;
   console.log(timeDifference)
    if(timeDifference>0){
      if(!global.clients[userId]) return;
  const client = global.clients[userId].client;
  if (client){
    console.log("have a client");
    
      setTimeout(() => {
        hay(client)
      }, timeDifference);
    }
  }
  } catch (error) {
    
  }
})


router.get("/again", authenticateToken, async (req, res) => {
    try {
    console.warn("req for QR in /again in time interval");
    if(global.clients[req.user._id]){
    console.log(global.clients[req.user._id].QR_CODE_DATA);
    try {
      if (global.clients[req.user._id].QR_CODE_DATA) {
        console.warn("req accept for QR in /again & QR sent");
        res.json({ qrCodeData: global.clients[req.user._id].QR_CODE_DATA });
      } 
    } catch (err) {
      
      console.log("error in /again when check the value of QR_CODE_DATA in global obj")
      console.log(err)
    }
  }
    else {
      console.warn("qr not genrate in /again");
      res.json({ qrCodeData: null });
    }
  } catch (error) {
      console.log(error)
  }
  });

router.get("/send-message", authenticateToken, async (req, res) => {
  message = `hyy from 360followups`;
  const user = await logIncollection.findById(req.user._id);
  console.log(user);
  let client;
  if(global.clients[user._id.toString()]){
    client = global.clients[user._id.toString()].client;
  }
  if (client) {
    console.log("client availiable");
  }
  if (!client) return res.status(400).send("User session not initialized");

  try {
    await client.sendMessage(`${916267181871}@c.us`, message);
    console.error("message send on whats num - 916267181871");
    res.redirect("/dashboard");
  } catch (error) {
    console.log(error);
  }
});

router.get("/connection-status", authenticateToken, async (req, res) => {
  console.warn("in /connection-status");

  let admin = await logIncollection.findById(req.user._id );
  let client;
  if (global.clients[admin._id]) {
    client = global.clients[admin._id].client;
  }
  if (client) {
    // console.warn(global.clients[admin._id].IS_CONNECTED)
    // console.warn(global.clients[admin._id].CONNECTED_PHONE)
    // console.warn(global.clients[admin._id].QR_CODE_DATA)
    // handleDisconnection(client, admin._id);
  }
  let userWA = await waModel.findOne({ cid: user.cid });

  // isConnected = false;
  if (userWA) {
    console.log(userWA.isConnected, user.name, "check connection//");

    return res.json({ isConnected: userWA.isConnected });
  } else {
    return res.json({ isConnected: false });
  }
});

// Endpoint to logout a specific user's session
router.get("/logoutWA", authenticateToken, async (req, res) => {
  let userId = req.user._id;
  if(!global.clients[userId]) return;
  const client = global.clients[userId].client;
  if (!client)
    return res.status(200).json({ errorMsg: "User session not initialized" });
  console.warn("try to go in logout try and client is availiable");

  try {
    console.log("we dont have any idea is client ready or not");
    try {
      await client.logout();
    } catch (er) {
      console.log("error in /logoutWA when i logout client", er);
    }
    console.log(`client logout ${req.user.name}`);
    let delWA = await waModel.findOneAndDelete({ cid: req.user._id });
    if (delWA) {
      console.warn("user Whatsapp document deleted");
    }
    // todo global client removing
    if (global.clients[userId]) {
      delete global.clients[userId];
      console.log(`Client removed from global clients: ${userId}`);
      console.log(`remain clients ${Object.keys(global.clients).length}`);
    }
    console.warn("session folder automatically deleted ");
    removeSession(userId);

    client.on("disconnected", () => {
      console.warn("whatsapp logout in clint on disconnected");
    });

    await delay(5000);
    res.redirect("/user/dashboard");
  } catch (error) {
    res.status(500).send("Failed to logout");
  }
});


// module.exports = { sendMessageToLead };
module.exports = router;

// async function sendMessageToLead(
//   adminWA,
//   phoneNumber,
//   message,
//   imagePath = null,
//   pdfPath = null
// ) {
//   if (adminWA === null || adminWA === undefined || adminWA === "") {
//     console.warn("WhatsApp client is not ready. please connect mobile number");
//     return;
//   }
//   console.log("Phone number", phoneNumber);

//   // Check if WhatsApp client is ready
//   if (adminWA && !adminWA.isConnected) {
//     console.warn(
//       "WhatsApp client is not ready. please re-connect mobile number isConnected in DB=",
//       adminWA.isConnected
//     );
//     return;
//   }
//   console.log(
//     "Trying to send message. Client ready status:",
//     adminWA.isConnected
//   );
//   // phoneNumber = "916267181871";

//   const user = await logIncollection.findOne({ cid: adminWA.cid });
//   console.log(user);
//   let client 
//   if( global.clients[user._id.toString()]){

//     client = global.clients[user._id.toString()].client;
//   }
//   if (client) {
//     console.log("client availiable");
//   }
//   if (!client) return "User session not initialized";

//   try {
//     // If imagePath and captionText are provided, send image with caption
//     if (imagePath && pdfPath) {
//       const imageMedia = MessageMedia.fromFilePath(imagePath);
//       const pdfMedia = MessageMedia.fromFilePath(pdfPath);

//       await client.sendMessage(`${phoneNumber}@c.us`, imageMedia, {
//         caption: message,
//       });

//       await client.sendMessage(`${phoneNumber}@c.us`, pdfMedia);
//     } else if ((imagePath && !pdfPath) || pdfPath == "") {
//       // send Only a image with text message
//       const imageMedia = MessageMedia.fromFilePath(imagePath);
//       await client.sendMessage(`${phoneNumber}@c.us`, imageMedia, {
//         caption: message,
//       });
//     } else if ((pdfPath && !imagePath) || imagePath == "") {
//       // send Only a pdf with text message
//       const pdfMedia = MessageMedia.fromFilePath(pdfPath);
//       await client.sendMessage(`${phoneNumber}@c.us`, pdfMedia, {
//         caption: message,
//       });
//     } else {
//       await client.sendMessage(`${phoneNumber}@c.us`, message);
//       console.log("Text message sent successfully!");
//     }
//   } catch (error) {
//     console.error("Error sending message:", error);
//   }
// }


function authenticateToken(req, res, next) {
    const token = req.cookies["whatsapp-Dev"];
  
    if (!token || token === undefined) {
      return res.redirect("/");
    }
  
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.log("token not decoded");
  
        return res.redirect("/");
      }
  
      req.user = decoded;
      // console.log(req.user);
      return next();
    });
  }

// todo remove all whatsapp session files from dir and delete docs from db fun
async function removeSessionDirectoriesOnRestartServer() {
  try {
    console.warn(
      " remove all whatsapp session files from dir and delete docs from db fun"
    );
    const sessionPath = path.join(__dirname, "sessions");
    if (!fs.existsSync(sessionPath)) return;

    // Read each client directory in the sessions folder
    const userIds = fs
      .readdirSync(sessionPath)
      .map((userId) => userId.replace("session-", ""));
    console.log(...userIds);

    userIds.forEach(async (user) => {
      let admin = await logIncollection.findById(user);
      await waModel.findOneAndDelete({ cid: admin._id });
    });
    // let allWhatsapp = await waModel.find()
    try {
      
      const result = await waModel.deleteMany({});
      console.log(result.lenght,"all users whatsapp remove on restart")
    } catch (error) {
      console.log(error)
    }
      userIds.forEach((userid) => {
      const userSessionPath = path.join(
        __dirname,
        "sessions",
        `session-${userid}`
      );
      if (fs.existsSync(userSessionPath)) {
        fs.rmSync(userSessionPath, { recursive: true, force: true });
        console.log(`Session directory for admin ${userid} deleted.`);
      } else {
        console.log(`No session directory found for admin ${userid}.`);
      }
    });
  } catch (error) {
    console.error("Error while removing session directories:", error);
  }
}

removeSessionDirectoriesOnRestartServer();
// todo remove all whatsapp session files from dir and delete docs from db fun

// todo light weight activitys using client
cron.schedule("* * * * *", async () => {
  try {
    const sessionPath = path.join(__dirname, "sessions");
    if (!fs.existsSync(sessionPath)) return;

    // Read each client directory in the sessions folder
    const userIds = fs
      .readdirSync(sessionPath)
      .map((userId) => userId.replace("session-", ""));
    console.log("allusers for start keaap alive functions ", userIds);

    userIds.forEach(async (user_id) => {
      // let admin = await logIncollection.findById(user_id);
      let WA = await waModel.findOne({ cid: user_id });
      // console.log(WA);
      if (WA) {
        console.log("WA is availiable");

        const client = global.clients[user_id].client;
        if (client) {
          console.log("try to start keepAliveFun");
          console.log(global.clients[user_id].IS_CONNECTED);
          startKeepAlive(client);
        } else {
          console.log("client not availiable");

          try {
            removeSession(user_id);
          } catch (error) {
            console.log(
              "error in start keep alive crone function when i remove session folder",
              error
            );
          }
        }
      }
    });
  } catch (err) {
    console.log(err);
  }
});

function setupClientEvents(client, userId) {
  client.on("qr", (qrCode) => {
    console.log(`QR code generated for user ${userId}`);
    // Generate QR code image
    try {
    const qrImage = qr.imageSync(qrCode, { type: "png" });
    let qrCodeData = `data:image/png;base64,${qrImage.toString("base64")}`;
    console.log("qrCodeData genrated here");
    console.log(qrCodeData);
    
    global.clients[userId].QR_CODE_DATA = qrCodeData;
  } catch (error) {
      console.log("error in client.on-QR when qr storing in QR_CODE_DATA ",error)
  }
  });

  client.on("ready", () => {
    console.log(`Client ready for user ${userId}`);
    try {
      
      global.clients[userId].CONNECTED_PHONE = client.info.wid.user;
      global.clients[userId].IS_CONNECTED = true;
    } catch (error) {
      console.log("ERROR in client.on-ready when mobile num and isConnected store in global obj",error)
    }
  });
  
  client.on("auth_failure", (msg) => {
    console.error(`Auth failure for user ${userId}:`, msg);
  });
  try {
    
    client.on("disconnected", (reason) => {
      console.log(`WhatsApp disconnected for user ${userId}:`, reason);
      try {
        if (global.clients[userId]) delete global.clients[userId];
        removeSession(userId);
        
      } catch (error) {
      console.log("ERROR in client.on-disconnected when delete global obj",error)
      
    }
    console.log(`Session cleared for user ${userId}`);
  });

} catch (error) {
    console.log(error)
}
}
async function startKeepAlive(client) {
    console.log("Starting keep-alive mechanism...");
  
    const activities = [
      async () => {
        const contacts = await client.getContacts();
        console.log("Keep-alive ping: Fetched contacts -", contacts.length);
      },
  
      async () => {
        const status = await client.getState();
        console.log("Keep-alive ping: WhatsApp state -", status);
      },
      async () => {
        const chats = await client.getChats();
        console.log("Keep-alive ping: Fetched chat list -", chats.length);
      },
      async () => {
        const groups = await client
          .getChats()
          .then((chats) => chats.filter((chat) => chat.isGroup));
        console.log("Keep-alive ping: Fetched groups -", groups.length);
      },
    ];
  
    // Perform a random action every 1 minute
  
      try {
        // Select a random activity from the list
        if (client.pupPage && client.pupPage.isClosed()) {
          console.log("Puppeteer session is closed. Trying to reconnect...");
        //   await client.initialize();
        } else {
          const randomActivity =
            activities[Math.floor(Math.random() * activities.length)];
  
          // Execute the selected activity
          await randomActivity();
        }
      } catch (error) {
        console.error("Error in keep-alive ping:", error);
      }
  }
//   const targetDate = new Date('2024-11-15T07:00:00');

//   cron.schedule("* * * * *", async () => {
//     try {
//         const currentDate = new Date();

//         // Check if current date and time match the target date and time
//         if (
//             currentDate.getFullYear() === targetDate.getFullYear() &&
//             currentDate.getMonth() === targetDate.getMonth() &&
//             currentDate.getDate() === targetDate.getDate() &&
//             currentDate.getHours() === targetDate.getHours()
//         ) {
//             console.log("Good Morning");
            
//         }
//     } catch (err) {
//       console.log(err);
//     }
//   });
  

  async function hay(client) {
    await client.sendMessage(`${916267181871}@c.us`, "message from dev to say auto call");
  }