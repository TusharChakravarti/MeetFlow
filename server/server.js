 import express from "express"
 import "dotenv/config"
 import cors from "cors"
 import http from "http"
 import { Server } from "socket.io"
import cookieParser from "cookie-parser";
import { initDB } from "./config/db.js";
import { clerkMiddleware } from '@clerk/express'
import {handleClerkWebhook, handleRazorpayWebhook}  from "./controllers/webhookController.js"
import meetingRouter from "./routes/meetingRoutes.js";
import { setupSocketIO } from "./socket.js";
import { error } from "console";
import billingRouter from "./routes/PricingRoutes.js";
 const app = express()
 const server = http.createServer(app)
 // Connect To Neon  & Initialize Tables
await initDB()



const allowedOrigins = process.env.ORIGINS.split(",")
 app.use(cors({origin:allowedOrigins,credentials:true}))
 app.use(cookieParser())

app.post("/api/clerk",express.raw({type:"application/json"}),handleClerkWebhook)
app.post("/api/webhooks/razorpay",express.raw({type:"application/json"}), handleRazorpayWebhook)


 app.use(express.json())
 app.use(clerkMiddleware())
 

 app.get("/",(req,res)=> res.send("API is Live!"))
 app.use("/api/meetings",meetingRouter)
 app.use("/api/billing",billingRouter)


 const io = new Server(server,{
    cors:{
        origin:allowedOrigins,
        credentials:true
    }
 })

 setupSocketIO(io)

 // Centralized Error Handler

 app.use((err,_req,res,_next)=>{
     console.error(`[Error] ${err.message}`)
     res.status(500).json({
        error:err.message
     })
 })




 const port = process.env.PORT || 3000;


server.listen(port,()=>{
    console.log(`Server is running at http://localhost:${port} `);
    
})




