import { sql } from "./config/db.js"

// Socket.IO Room State: roomId -> Map<socketId,participantObject>

const rooms = new Map()

export function setupSocketIO(io){
io.on("connection",(socket)=>{
 let currentRoomId = null
 let currentUser = null

 // User joins a meeting Room
 socket.on("join-room",async ({roomId,user,audioEnabled = true,videoEnabled = true})=>{
    // to avoid duplicate joining
  try {
    if(currentRoomId && currentRoomId===roomId && rooms.get(roomId)?.has(socket.id)){
         return;
    }

    if(currentRoomId && roomId!==currentRoomId){
        const previousRoom = rooms.get(currentRoomId);
        if(previousRoom){
            previousRoom.delete(socket.id)
            if(previousRoom.size === 0) {
                rooms.delete(previousRoom)
            }else{
                io.to(currentRoomId).emit("user-left",{
                    socketId:socket.id,
                    user:currentUser
                })
            }
        }

        socket.leave(currentRoomId);
        currentRoomId = null
        currentUser = null;


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
    
    const isHost = meeting.host_id && user?.id && meeting.host_id.toString() === user.id.toString()
    currentUser = {
        socketId:socket.id,
        userId:user?.id,
        userName:user?.name || "Anonymous",
        isHost,
        audioEnabled,
        videoEnabled
    }

    if(!rooms.has(roomId)){
        rooms.set(roomId,new Map())
}

const roomParticipants = rooms.get(roomId)


// Fetch host plan to enforce participants limit (10 for Free,100 for Premium)

const hosts = await sql`
SELECT plan FROM users WHERE id = ${meeting.host_id}
`
const hostPlan = hosts[0]?.plan || "free"

const maxParticipants = hostPlan === "premium"?100:10

if(roomParticipants.size >= maxParticipants ){
    socket.emit("meeting-ended",{
        message:`Meeting capacity limot reached (max ${maxParticipants}
        participants for ${hostPlan.toUpperCase()} plan). Host must upgrade to Premium for upto 100 participants!
        `
    })
    return;
}
currentRoomId = roomId;
socket.join(roomId)

// Get existing participants in the room
const existingUsers = Array.from(roomParticipants.values())

// Add new participants to socket state

roomParticipants.set(socket.id,currentUser)


// Save partcipant to DB if not already present

const userId = user?.id || null
const existingParticipants = await sql `
SELECT id FROM meeting_participants
WHERE meeting_id = ${meeting.id}
AND(
(${userId}::text IS NOT NULL  AND user_id= ${userId})
OR name = ${currentUser.userName}
)


`

if(existingParticipants.length === 0 ){
    await sql`
    INSERT INTO meeting_participants (meeting_id,user_id,name,joined_at)
    VALUES (${meeting.id}, ${userId},${currentUser.userName},NOW())
    `
}
 
// send list of existing users to newcomer

socket.emit("all-users",existingUsers)

// Notify everyone else in the room
socket.to(roomId).emit("user-joined",currentUser)


  } catch (err) {
    console.error("Error joining room in socket:",err)
    socket.emit("meeting-ended",{
        message:"Failed to join room."
    })
  }
 })

 socket.on("typing",({roomId,userId,userName})=>{
    if(!roomId || !userName) return;

    if(!socket.rooms.has(roomId)) return;

    // Notify other participants
    socket.to(roomId).emit("user-typing",{
        userId,
        userName
    })

 })

 socket.on("stop-typing",({roomId,userId})=>{
        if(!roomId || !userId) return;

    if(!socket.rooms.has(roomId)) return;

    socket.to(roomId).emit("user-stopping-typing",{
        userId
    })
 })
 // WebRTC Signaling: Offer

 // send the information needed to start the connection

 socket.on("offer",({targetSocketId,callerSocketId,sdp})=>{
    io.to(targetSocketId).emit("offer",{
        callerSocketId,
        sdp,
        callerUser:currentUser
    })
 
 })


 // WebRTC Signaling : Answer
// accept the offer request and process connection
  socket.on("answer",({targetSocketId,responderSocketId,sdp})=>{
    io.to(targetSocketId).emit("answer",{
        responderSocketId,
        sdp,
    })
 
 })

 // WebRTC signalling: ICE candidate
 // passes the connection details from one user to the other so WebRTC can figure out how to connect them directly

 socket.on("ice-candidate",({targetSocketId,senderSocketId,candidate})=>{
 io.to(targetSocketId).emit("ice-candidate",{
    senderSocketId,
    candidate
 }
 )

 
 })

 // Audio toggle Event

 
 socket.on("toggle-audio",({roomId,audioEnabled})=>{

if(rooms.has(roomId) && rooms.get(roomId).has(socket.id)){
    rooms.get(roomId).get(socket.id).audioEnabled = audioEnabled
}
socket.to(roomId).emit("user-toggled-audio",{
    socketId:socket.id,
    audioEnabled
})

 
 })


// Video toggle event

  socket.on("toggle-video",({roomId,videoEnabled})=>{

if(rooms.has(roomId) && rooms.get(roomId).has(socket.id)){
    rooms.get(roomId).get(socket.id).videoEnabled= videoEnabled
}
socket.to(roomId).emit("user-toggled-video",{
    socketId:socket.id,
    videoEnabled
})

 
 })

 // Chat message event -> persist to DB & broadcast

socket.on("send-message",async({roomId,message})=>{
 try {
    const meetings = await sql`
    SELECT id,status FROM meetings WHERE meeting_id = ${roomId}
    `
    if(meetings.length>0 && meetings[0].status!="ended"){
        const meetingId = meetings[0].id;
        const senderId = message.senderId || null

        await sql `
        INSERT INTO  meeting_messages (meeting_id,sender_id,sender_name,text,timestamp)
        VALUES(${meetingId},${senderId},${message.senderName || "Anonymous"},${message.text},NOW())

        `
        io.in(roomId).emit("receive-message",{
            ...message,
            senderSocketId:socket.id
        })

        

    }
    
 } catch (err) {
    console.error("Error saving chat messages to DB:",err)
    
 }
})

// Host explicitly ends meeting for all via End Meeting button

socket.on("end-meeting",async ({roomId})=>{
    try {
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
    } catch (err) {
        console.error("Error ending meeting:",err)
    }

})

// Handle Disconnect (Reloading window,network drop or closing tab)

socket.on("disconnect",()=>{
  if(currentRoomId && rooms.has(currentRoomId)){
    const roomParticipants = rooms.get(currentRoomId)
    roomParticipants.delete(socket.id)
    if(roomParticipants.size===0){
        rooms.delete(currentRoomId)
    }
    else{
        //Notify remaining peers that a user disconnected
        io.to(currentRoomId).emit("user-left",{
            socketId:socket.id,
            user:currentUser
        })

    }  
  }

})


})
}

