import { clerkClient, getAuth } from "@clerk/express";
import { sql } from "../config/db.js";
export const protect =async(req,res,next)=>{

    try {

           const auth = getAuth(req);
           
    const userId = auth?.userId || req.auth()?.userId


    if(!userId){
            return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }


    const users = await sql`
    SELECT id,name,plan
    FROM users 
    WHERE id = ${userId}

    `

    
    if(users.length==0){
     const clerkUser = await clerkClient.users?.getUser(userId);
     const name = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim()|| clerkUser.username || "User"
     const email= clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId )?.emailAddress || "";

     await sql `
     INSERT INTO users (id,name,email,image)
     VALUES (${userId},${name},${email},${clerkUser.imageUrl || ""})
     ON CONFLICT DO NOTHING
     `
     users = await sql `
     SELECT id,name,plan FROM users WHERE id = ${userId}
     `
     
    }
  
    req.user = users[0];

    next();
        
    } 

     catch (error) {
    console.error("Authentication middleware failed:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
 



}

