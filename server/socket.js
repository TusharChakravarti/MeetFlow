import { authenticateRequest } from "@clerk/express"
import { sql } from "./config/db.js"

// Socket.IO Room State: roomId -> Map<socketId,participantObject>

const rooms = new Map()
const activePresenters = new Map()


export function setupSocketIO(io){
io.on("connection",(socket)=>{
    
 let currentRoomId = null
 let currentUser = null

 const leaveCurrentRoom = async ()=>{
    if(!currentRoomId) return;
    const roomId = currentRoomId
    const leavingUser = currentUser

    // Clean up in memory state
    currentRoomId = null
    currentUser = null

    const roomParticipants = rooms.get(roomId)

    let activeElsewhere  =  false;
   if(roomParticipants){
    const wasPresent = roomParticipants.delete(socket.id)
      // Check whether another socket for this user is still in the room
     activeElsewhere:leavingUser?.userId?
     [...roomParticipants.values()].some(
        (participant)=>participant.userId === leavingUser.userId
     ):false;

     if(wasPresent){
    if(roomParticipants.size === 0){
            rooms.delete(roomId)
               // No participants left, so remove presenter ownership
            activePresenters.delete(roomId)
        }
        else{
            socket.to(roomId).emit("user-left",{
                socketId:socket.id,
                user:leavingUser
            })
        }

     }
   

        }
               if(activePresenters.get(roomId) === socket.id){
     activePresenters.delete(roomId)
  }

  socket.leave(roomId)

   // 2. Update database after in-memory cleanup
   try {
        if(leavingUser?.userId && !activeElsewhere){
        await sql`
        UPDATE meeting_participants 
        SET left_at = NOW()
        WHERE meeting_id = 
        (
        SELECT id FROM meetings
        WHERE meeting_id == ${roomId}
        )
        and user_id = ${currentUser.userId}
        AND left_at IS NULL
        `
    }
    
   } catch (error) {
    console.error("left_at update failed:",err);
    
   }






   }
  
   

 

    









 // User joins a meeting Room
 socket.on("join-room",async ({roomId,user,audioEnabled = true,videoEnabled = true})=>{
    console.log("BACKEND JOIN ROOM RECEIVED", {
    socketId: socket.id,
    userId: socket.data.userId,
    roomId
});

  try {
      // Identity comes from the verified Clerk token
    const authenticatedUserId = socket.data.userId

    if(!authenticatedUserId || !roomId) return;
      // to avoid duplicate joining
    if(currentRoomId===roomId && rooms.get(roomId)?.has(socket.id)){
         return;
    }

    if(currentRoomId && roomId!==currentRoomId){
        await leaveCurrentRoom()

    }

    // verify meeting status from DB
    const meetings  = await sql `
    SELECT * FROM meetings WHERE meeting_id = ${roomId}
    `

    if(meetings.length === 0){
       socket.emit("meeting-ended",{
        message:"Meeting not found"
       })
       return;
    }
    const meeting = meetings[0]

    if(meeting.status === "ended"){
        socket.emit("meeting-ended",{
            message:"This meeting has already ended"
        })
        return;
    }

      // Fetch the authenticated user's profile from our database
      const dbUsers = await sql`
      SELECT id,name FROM users WHERE id = ${authenticatedUserId}
      `
      if(dbUsers.length === 0){
        socket.emit("meeting-ended",{
            message:"User profile not found.Please refresh and sign in again"
        })
        return;
      }
      
      const dbUser = dbUsers[0]
    
    const isHost = String(meeting.host_id) === String(authenticatedUserId);
    currentUser = {
        socketId:socket.id,
        userId:authenticatedUserId,
        userName:dbUser?.name || "Anonymous",
        isHost,
        audioEnabled,
        videoEnabled
    }

    if(!rooms.has(roomId)){
        rooms.set(roomId,new Map())
}

const roomParticipants = rooms.get(roomId)

let oldSocketToRemove = null

for(const [oldSocketId, participant] of roomParticipants){
    if(participant.userId === authenticatedUserId && oldSocketId !== socket.id){
       oldSocketToRemove = oldSocketId
       break;

     
    }
}


// Fetch host plan to enforce participants limit (10 for Free,100 for Premium)

const hosts = await sql`
SELECT plan FROM users WHERE id = ${meeting.host_id}
`
const hostPlan = hosts[0]?.plan || "free"

const maxParticipants = hostPlan === "premium"?100:10

const effectiveToomSize = roomParticipants.size - (oldSocketToRemove?1:0)

if(effectiveToomSize>= maxParticipants ){
    socket.emit("meeting-ended",{
        message:`Meeting capacity limit reached (max ${maxParticipants}
        participants for ${hostPlan.toUpperCase()} plan). Host must upgrade to Premium for upto 100 participants!
        `
    })
    return;
}

currentRoomId = roomId;
socket.join(roomId)

// Get existing participants in the room
const existingUsers = Array.from(roomParticipants.values()).filter(p=>p.userId !== authenticatedUserId)

// Add new participants to socket state

roomParticipants.set(socket.id,currentUser)

if(oldSocketToRemove){
    const oldSocket = io.sockets.sockets.get(oldSocketToRemove);

    if(oldSocket){
              console.log("DISCONNECTING OLD SOCKET:",{
                   oldSocketId: oldSocketToRemove,
    newSocketId: socket.id,
    userId: authenticatedUserId,
    roomId
              });
              oldSocket.disconnect(true);
    }
    else{
        roomParticipants.delete(oldSocketToRemove)
    }
}


// Save partcipant to DB if not already present

const userId = user?.id || null
const existingParticipants = await sql `
SELECT id FROM meeting_participants
WHERE meeting_id = ${meeting.id}
AND user_id = ${authenticatedUserId}


`

if(existingParticipants.length === 0 ){
    await sql`
    INSERT INTO meeting_participants (meeting_id,user_id,name,joined_at)
    VALUES (${meeting.id}, ${authenticatedUserId},${currentUser.userName},NOW())
  
    `
}
else{
    await sql`
    UPDATE meeting_participants
    SET left_at = NULL
    joined_at = NOW(
    name = ${currentUser.userName}
    WHERE id = ${existingParticipants[0].id}
    `
}
 
// send list of existing users to newcomer

const activePresenterId = activePresenters.get(roomId) || null

// Stop processing if the socket disconnected during DB queries
if(!socket.connected || currentRoomId!==roomId) return;

socket.emit("all-users",{
    users:existingUsers,
    activePresenterId

})

// Notify everyone else in the room
socket.to(roomId).emit("user-joined",currentUser)


  } catch (err) {
    console.error("Error joining room in socket:",err)
    if(currentRoomId){
        await leaveCurrentRoom()
    }
    socket.emit("meeting-ended",{
        message:"Failed to join room."
    })
  }
 })

 socket.on("typing",({roomId})=>{
  if (!currentRoomId || currentRoomId !== roomId) return;
  if (!rooms.get(roomId)?.has(socket.id)) return;
    if(!socket.rooms.has(roomId)) return;

    // Notify other participants
    socket.to(roomId).emit("user-typing",{
        userId:currentUser.userId,
        userName:currentUser.userName
    })

 })

 socket.on("stop-typing",({roomId})=>{
       if (!currentRoomId || currentRoomId !== roomId) return;
  if (!rooms.get(roomId)?.has(socket.id)) return;

    if(!socket.rooms.has(roomId)) return;

    socket.to(roomId).emit("user-stopping-typing",{
        userId:currentUser.userId
    })
 })
 // WebRTC Signaling: Offer

 // send the information needed to start the connection

 socket.on("offer",({targetSocketId,callerSocketId,sdp,screenStreamId})=>{
     if(!currentRoomId || callerSocketId !==socket.id) return;
     const participants = rooms.get(currentRoomId)
     if(!participants?.has(socket.id) || !participants.has(targetSocketId)) return;
    io.to(targetSocketId).emit("offer",{
        callerSocketId,
        sdp,
        callerUser:currentUser,
        screenStreamId
    })
 
 })


 // WebRTC Signaling : Answer
// accept the offer request and process connection
  socket.on("answer",({targetSocketId,responderSocketId,sdp,screenStreamId})=>{
    if(!currentRoomId || responderSocketId !==socket.id) return
        const partcipants = rooms.get(currentRoomId)

        if(!partcipants?.has(socket.id)||!partcipants.has(targetSocketId)) return;
 
    io.to(targetSocketId).emit("answer",{
        responderSocketId,
        sdp,
        screenStreamId
    })
 
 })

 // WebRTC signalling: ICE candidate
 // passes the connection details from one user to the other so WebRTC can figure out how to connect them directly

 socket.on("ice-candidate",({targetSocketId,senderSocketId,candidate})=>{
    if(!currentRoomId || senderSocketId !==socket.id) return;
    const partcipants = rooms.get(currentRoomId);
    if(!partcipants?.has(socket.id)||!partcipants.has(targetSocketId)) return;
 io.to(targetSocketId).emit("ice-candidate",{
    senderSocketId,
    candidate
 }
 )

 
 })

 socket.on("request-screen-share",({roomId})=>{

     

    //Verify that the user belongs to this meeting


    if (!currentRoomId || currentRoomId !== roomId) return;
    if(!rooms.get(currentRoomId)?.has(socket.id)){
        return;
    }

    if(activePresenters.get(roomId)===socket.id){
     
        return;
    }

    //  Find the current presenter

    const previousPrsesnterId = activePresenters.get(roomId)

      // Assign the new presenter

      activePresenters.set(roomId,socket.id)

        //  Tell the previous presenter to stop sharing

        if(previousPrsesnterId && previousPrsesnterId !==socket.id){
            io.to(previousPrsesnterId).emit("force-stop-screen-share")
        }

        // Approve the new presenter

        socket.emit("screen-share-approved")

   


 })

      socket.on("cancel-screen-share",({roomId})=>{
             // Only the active presenter can release ownership
               if (!currentRoomId || currentRoomId !== roomId) return;
           if (!rooms.get(currentRoomId)?.has(socket.id)) return;
            if(activePresenters.get(roomId)===socket.id){
                activePresenters.delete(roomId)
            }

            socket.to(roomId).emit("screen-share-stopped",{
                socketId:socket.id
            })
        })
 // Audio toggle Event

 
 socket.on("toggle-audio",({roomId,audioEnabled})=>{
    if(!currentRoomId||currentRoomId!==roomId) return;
    const participants = rooms.get(currentRoomId);
if(!participants?.has(socket.id)) return;

    participants.get(socket.id).audioEnabled = Boolean(audioEnabled)

socket.to(roomId).emit("user-toggled-audio",{
    socketId:socket.id,
    audioEnabled
})

 
 })


// Video toggle event

  socket.on("toggle-video",({roomId,videoEnabled})=>{

    if (!currentRoomId || currentRoomId !== roomId) return;
     const participants = rooms.get(currentRoomId);

if (!participants?.has(socket.id)) return;


  participants.get(socket.id).videoEnabled= Boolean(videoEnabled)

socket.to(roomId).emit("user-toggled-video",{
    socketId:socket.id,
    videoEnabled
})

 
 })

 // Chat message event -> persist to DB & broadcast

socket.on("send-message",async({roomId,message})=>{
 try {
    if (!currentRoomId || currentRoomId !== roomId) return;
if (!rooms.get(currentRoomId)?.has(socket.id)) return;


  
       const text = typeof message?.text === "string"? message.text.trim():""

       if(!text || text.length>5000) return;

     

    const meetings = await sql`
    SELECT id,status FROM meetings WHERE meeting_id = ${roomId}
    `
    if(meetings.length===0 || meetings[0].status === "ended") return;
       const meetingId = meetings[0].id;
       
      

        await sql `
        INSERT INTO  meeting_messages 
        (meeting_id,sender_id,sender_name,text,timestamp)
        VALUES
        (${meetingId},
        ${currentUser.userId},
        ${currentUser.userName || "Anonymous"},
        ${text},NOW())

        `
        io.in(roomId).emit("receive-message",{
            ...message,
            text,
            senderId:currentUser.userId,
            senderName:currentUser.userName,
            senderSocketId:socket.id,
            timestamp:new Date().toISOString()
        })

        

    
    
 } catch (err) {
    console.error("Error saving chat messages to DB:",err)
    
 }
})

// Host explicitly ends meeting for all via End Meeting button

socket.on("end-meeting",async ({roomId})=>{
    try {
  
        if (!currentRoomId || currentRoomId !== roomId) return;
if (!rooms.get(currentRoomId)?.has(socket.id)) return;
if(!currentUser?.isHost) return;
        await sql`
        UPDATE meetings 
        SET status = 'ended', ended_at = NOW()
        WHERE meeting_id = ${roomId}
        `
        io.to(roomId).emit("meeting-ended",{
         message:"Meeting has been ended by the host",
    
        })
         io.in(roomId).socketsLeave(roomId)
             rooms.delete(roomId)
             activePresenters.delete(roomId)
    } catch (err) {
      console.error("Error ending meeting:",err)
    }

})

// Leave room

socket.on("leave-room",async ()=>{
   await leaveCurrentRoom()
})

// Handle Disconnect (Reloading window,network drop or closing tab)

socket.on("disconnect",async(reason)=>{
        console.log("SOCKET DISCONNECTED:", {
        socketId: socket.id,
        userName: currentUser?.userName,
        reason
    });

    await leaveCurrentRoom()
}
)


})
}

