// create meeting

import { sql } from "../config/db.js";

const generateMeetingId = ()=>{
    const chars = "abcdefghijklmnopqrstuvwxyz"

    const segment =  (len)=> Array.from({length:len},()=> chars[Math.floor(Math.random*chars.length)]).join('')
    
  return `${segment(3)}-${segment(3)}-${segment(3)}`

}

export const createMeeting = async(req,res)=>{

    try {
        const {title} = req.body;
        const userId = req.user.id 

        // Fetch user details & plan

        const users = await sql`
        SELECT name,plan FROM users WHERE id =  ${userId}


        `
        const userPlan = users[0]?.plan || "free" 

        // check meeting limit per calender month

        if(userPlan == "free"){
            const monthlycountResult = await sql`
              SELECT COUNT(*) as count FROM meetings where host_id = ${userId}
              AND created_at >= DATE_TRUNC('month',NOW())
            `
            const monthlycount = parseInt(monthlycountResult[0]?.count||'0')
            if(monthlycount>=30){
                return res.status(403).json({
                    error:"Monthly limit reached.Free plan includeds 30 meetings per month.Please upgrade to Premium for unlimited meetings!",
                    limitReached:true,
                    monthlycount,
                    limit:30,


                })
            }

        }

        let meetingId = generateMeetingId()

        // Ensure unique ID

        let existing = await sql `
         SELECT id FROM meetings WHERE meeting_id = ${meetingId}
        `
     while(existing.length>0){
        meetingId = generateMeetingId()
        existing = await sql `
         SELECT id FROM meetings WHERE meeting_id = ${meetingId}
        `
        
     }

     const [meeting]= sql`
     INSERT INTO meetings(meeting_id,title,host_id,status)
     VALUES (${meetingId},${title||"Instant Meeting"}, ${userId} , "active" )
     RETURNING id,meeting_id,title,host_id,status,created_at
     `

     const hostname = users[0]?.name || "Host"

     // Insert host into participants

     await sql`
     INSERT INTO meeting_participants(meeting_id,user_id,name)
     VALUES (${meeting.id},${userId},${hostname})

     `

res.status(201).json({
    meeting:{
        id:meeting.id,
        meetingId:meeting.meeting_id,
        title:meeting.title,
        host:meeting.host_id,
         status:meeting.status,
         createdAt:meeting.created_at
    }
})



        
    } catch (error) {
       res.status(500).json({
        error:error.message
       })
    }
}

// get meering by id

export const getMeeting = async(req,res)=>{
try {
    const {meetingId} = req.params;

    const meetings = await sql `
    SELECT m.*,u.id as host_user_id,u.name as host_name,u.email as host_email FROM meetings m JOIN users u ON m.host_id = u.id WHERE m.meeting_id  = ${meetingId}
    `
    if(meetings.length===0){
        return res.status(404).json({
            error:"Meeting Not found"
        })
    }
    const meeting = meetings[0]

    if(meeting.status==="ended"){
        res.status(400).json({
            error:"This meeting has ended"
        })
    }

    res.json({
   meeting:{
        id:meeting.id,
        meetingId:meeting.meeting_id,
        title:meeting.title,
         status:meeting.status,
         createdAt:meeting.created_at,
         host:{
           id: meeting.host_user_id,
           name:meeting.host_name,
           emil:meeting.host_email


         }
    }
    })

} catch (error) {
      res.status(500).json({
        error:error.message
       })
}
}

// get all user's meeting sessions

export const getUserSessions= async(req,res)=>{

}



// get meeting session deatails by id

export const getSessionDetails= async(req,res)=>{
   try {
    const userId = req.user.id

    // Fetch meetings where user is host OR listed in participants

    const meetings = await sql`
    SELECT DISTINCT m.id,m.meeting_id,m.title,m.status,m.created_at,m.ended_at,m.host_id,
    u.name as host_name,u.email as host_email FROM meetings m
    JOIN users u ON m.host_id = u.id
    LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id
    WHERE m.host_id = ${userId} OR mp.user_id = ${userId}
    ORDER BY m.creared_at DESC
    
`
    
   } catch (error) {
      res.status(500).json({
        error:error.message
       })

   }

}


// get plan & meetings statistics for user dashboard


export const getMeetingStats= (req,res)=>{

}





    