import { getAuth } from "@clerk/express";
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

    req.user = {id:userId};

    const users = await sql`
    SELECT id,name,plan
    FROM users 
    WHERE id = ${userId}

    `

    
    if(users.length==0){
        return res.status(404).json({
        success: false,
        message: "User not found",
        })
    }
  

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

