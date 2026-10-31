import React, { useCallback, useEffect, useRef, useState } from 'react'
import socket from "../config/socket"
import toast from 'react-hot-toast';


const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
    ],
};

const useWebRTC = (roomId,user,onMeetingEnded,enabled = true) => {
  const [localStream,setLocalStream] = useState(null)
  const [remoteUsers,setRemoteUsers] = useState([]) // Array of { socketId, userId, userName, stream, audioEnabled, videoEnabled }
  const [audioEnabled,setAudioEnabled] = useState(true)
  const [videoEnabled,setVideoEnabled] = useState(true)

  const peersRef = useRef(new Map()) // socketId -> RTCPeerConnection
  const localStreamRef = useRef(null)

  const mediaRef = useRef({audioEnabled,videoEnabled})

  const icecandidateQueue = useRef(new Map())
  const processingCandidates = useRef(new Set())

  useEffect(()=>{
  mediaRef.current = {audioEnabled,videoEnabled}
  },[audioEnabled,videoEnabled])

  // Initialize local camera stream if available in browser
  const initLocalStream = useCallback(async ()=>{
  
    
    try {
      if(navigator?.mediaDevices?.getUserMedia){
        
        const stream = await navigator?.mediaDevices?.getUserMedia({
          video:true,
          audio:true
        })
        localStreamRef.current = stream;
        setLocalStream(stream)
        return stream;
      }
    } catch (error) {
      toast.error("Could not access camera/microphone");
      console.error("Media devices access error:", error);
       // Fallback: try audio only
       try {
        const audioStream = await navigator?.mediaDevices?.getUserMedia({
          audio:true
        })
        localStreamRef.current = audioStream
        setLocalStream(audioStream)
        setVideoEnabled(false)
        return audioStream;
       } catch (error) {
        console.error("Audio-only fallback error:", error);
           return null;
       }
      
    }

  },[])

  const processCandidateQueue = async (senderSocketId,peer)=>{
    if (processingCandidates.current.has(senderSocketId)) return;
    processingCandidates.current.add(senderSocketId)
    try{
         while(icecandidateQueue.current.has(senderSocketId)){
  const candidates = icecandidateQueue.current.get(senderSocketId)||[]
           // Remove this batch before processing it
          icecandidateQueue.current.delete(senderSocketId)

     for (const candidate of candidates) {
  try {
    await peer.addIceCandidate(candidate);
  } catch (error) {
    console.error("Error adding queued ICE candidate", error);
  }
}
      
    }
    }
    finally{
      processingCandidates.current.delete(senderSocketId)
    }

     

     
  }

   // Create RTCPeerConnection for a target socket
   const createPeerConnection  = useCallback((targetSocketId,targetUser)=>{
    if(peersRef.current.has(targetSocketId)){
      return peersRef.current.get(targetSocketId)

    }

       
      const peer = new RTCPeerConnection(ICE_SERVERS)

      peer.onconnectionstatechange = ()=>{
        const state = peer.connectionState;
        console.log(`Peer ${targetSocketId} connection state:`,state)
        if(state === "closed"|| state == "failed"){
          peer.close()
          if(peersRef.current.get(targetSocketId)===peer){
          peersRef.current.delete(targetSocketId)

          setRemoteUsers(prev=> prev.filter((u)=>u.socketId!==targetSocketId))
          }

        }
      }
       // Add local tracks to peer connection
      if(localStreamRef.current){
        localStreamRef.current.getTracks().forEach((track)=>{
        peer.addTrack(track,localStreamRef.current)
        })
      }

         // Handle ICE candidates

         peer.onicecandidate = (event)=>{
          if(event.candidate){
            socket.emit("ice-candidate",{
              targetSocketId,
              senderSocketId:socket.id,
              candidate:event.candidate

            })
          }
         }
           // Handle incoming remote stream tracks

           peer.ontrack = (event)=>{
            const remoteStream = event.streams[0]
            setRemoteUsers((prev)=> {
             const existingIndex = prev.findIndex((u)=> u.socketId === targetSocketId)
             
             if(existingIndex>-1){
              const updated  = [...prev]
              updated[existingIndex] = {
                ...updated[existingIndex],
                 stream:remoteStream
              }
              return updated
             }
             else{
              return [
                ...prev,
                {
                  socketId:targetSocketId,
                  userId:targetUser?.id,
                  userName:targetUser?.userName || "Partcipant",
                  stream:remoteStream,
                 audioEnabled:targetUser?.audioEnabled ?? true,
                 videoEnabled:targetUser?.videoEnabled ?? true

                }

              ]
             }

           })
          
              
           }

 peersRef.current.set(targetSocketId,peer)


 return peer

   },[])

   // Main WebRTC & Socket signaling setup effect

  useEffect(()=>{

if(!roomId || !user ||!enabled) return;

let isMounted = true;

  //Join only after connection
const joinRoom = ()=>{
  socket.emit("join-room",{
    roomId,
    user,
    audioEnabled:mediaRef.current.audioEnabled,
    videoEnabled:mediaRef.current.videoEnabled
  })

} 

const handleAllUsers = async(existingUsers)=>{
 for(const existingUser of existingUsers){
  if(!isMounted) return;
  const peer = createPeerConnection(
    existingUser.socketId,
    existingUser
  )

  try {
    const offer  = await peer.createOffer()
          if (!isMounted) return;
          await peer.setLocalDescription(offer)
               if (!isMounted) return;

               socket.emit("offer",{
                targetSocketId:existingUser.socketId,
                callerSocketId:socket.id,
                sdp:peer.localDescription
               })

  } catch (error) {
     console.error("Error creating offer:", error);
  }
 }
}

const handleUserJoined = (newUser)=>{
  toast(`${newUser.userName} joined the meeting` , { icon: "👋" })
      createPeerConnection(newUser.socketId,newUser)
}

const handleOffer = async ({callerSocketId, sdp,callerUser})=>{
 const peer = createPeerConnection(callerSocketId,callerUser)
           try {
            
           await peer.setRemoteDescription(new RTCSessionDescription(sdp))
               if (!isMounted) return;
           await processCandidateQueue(callerSocketId,peer)
               if (!isMounted) return;

           const answer = await peer.createAnswer()
               if (!isMounted) return;
            await peer.setLocalDescription(answer)
                 if (!isMounted) return;
            socket.emit("answer",{
            
              targetSocketId:callerSocketId,
              responderSocketId:socket.id,
              sdp:peer.localDescription
            })

            
           } catch (err) {
              console.error("Error handling offer:", err);
           }


}

const handleAnswer = async ({responderSocketId,sdp})=>{
              const peer = peersRef.current.get(responderSocketId);
              if(peer){
                try {
                  await peer.setRemoteDescription(new RTCSessionDescription(sdp))
                      if (!isMounted) return;
                  await processCandidateQueue(responderSocketId,peer)

                } catch (error) {
                   console.error("Error setting remote description from answer:", error);
                }
              }
         }



      const handleIceCandidate = async ({senderSocketId,candidate})=>{

            try {
               const peer = peersRef.current.get(senderSocketId)
                const iceCandidate = new RTCIceCandidate(candidate)
                 // Peer doesn't exist OR remote description isn't ready
              if(!peer||!peer.remoteDescription||processingCandidates.current.has(senderSocketId)){
                if(!icecandidateQueue.current.has(senderSocketId)){
                  icecandidateQueue.current.set(senderSocketId,[])
                }
                icecandidateQueue.current.get(senderSocketId).push(iceCandidate)
                return;
              }

             

           

                     
                         await peer.addIceCandidate(iceCandidate)
                      
                  
              
     
            
} catch (error) {
     console.error("Error handling ICE candidate:", error);

}

          
              
            
              

            }

            const handleUserAudioToggle = ({socketId,audioEnabled})=>{
                setRemoteUsers((prev)=>prev.map(
                  (u)=> u.socketId == socketId ? {...u,audioEnabled}:u
                ))

              }

              const handleUserVideoToggle = ({socketId,videoEnabled})=>{
                setRemoteUsers((prev)=>prev.map(
                  (u)=> u.socketId == socketId ? {...u,videoEnabled}:u
                ))

              }

              const handleUserLeft = ({socketId,user: leftUser})=>{
                  if(leftUser){
                    toast(`${leftUser.userName} left the meeting`)
                  }
                  const peer = peersRef.current.get(socketId)

                  if(peer){
                        peer.close()
                        peersRef.current.delete(socketId)

                  }
                 // Clean up pending ICE candidate

                 icecandidateQueue.current.delete(socketId)

                 setRemoteUsers((prev)=>prev.filter((u)=> u.socketId!==socketId))
                   

              
               
                 
                }

                const handleMeetingEnded = ({message})=>{
                      toast.error(message||"This meeting has ended")
                      if(onMeetingEnded){
                    onMeetingEnded(message)
                      }
                    
                  
                     }

const startSession = async ()=>{



   // Register socket listeners

    // 1. Receive all existing users in room
  socket.on("all-users",handleAllUsers)
     // 2. Someone new joined -> add to state
     socket.on("user-joined",handleUserJoined)

         // 3. Receive offer from caller

         socket.on("offer",handleOffer)

         // 4. Receive answer from responder
         socket.on("answer",handleAnswer)

            // 5. Receive ICE candidate

            socket.on("ice-candidate",handleIceCandidate)

              // 6. Handle peer audio toggle

              socket.on("user-toggled-audio",handleUserAudioToggle)

                // 7. Handle peer video toggle
               socket.on("user-toggled-video",handleUserVideoToggle)

                // 8. Handle peer left

                socket.on("user-left",handleUserLeft)

                     // 9. Handle meeting ended by host

                  socket.on("meeting-ended",handleMeetingEnded)




  const stream = await initLocalStream()
  if(!isMounted){
    if(stream){
      stream.getTracks().forEach((track)=> track.stop());
    }
   if(localStreamRef.current === stream){
    localStreamRef.current = null
   }

    return;
  }



socket.on("connect",joinRoom);

  if(!socket.connected){
    socket.connect()
  }
  else{
    joinRoom()
  }


                    

}

  startSession();

  


         // Cleanup on leave/unmount

  return ()=>{
    isMounted = false
          
 

     // Close all peer connections
    peersRef.current.forEach((peer)=>peer.close())
    peersRef.current.clear()

       // Off socket listeners
       socket.off("connect",joinRoom)
   socket.off("all-users",handleAllUsers)
   socket.off("user-joined",handleUserJoined)
   socket.off("offer",handleOffer)
   socket.off("answer",handleAnswer)
  socket.off("ice-candidate",handleIceCandidate)
  socket.off("user-toggled-audio",handleUserAudioToggle)
  socket.off("user-toggled-video",handleUserVideoToggle);
  socket.off("user-left",handleUserLeft);
  socket.off("meeting-ended",handleMeetingEnded);

 
  icecandidateQueue.current.clear()
  processingCandidates.current.clear();
// Stop local tracks
  if(localStreamRef.current){
    localStreamRef.current.getTracks().forEach(track=>track.stop())
    localStreamRef.current = null;
  }

  }


  },[roomId,user?.id,enabled,createPeerConnection,initLocalStream,onMeetingEnded])


  


 // Toggle local mic
 const toggleAudio = ()=>{


  if(localStreamRef.current){
    const audioTrack = localStreamRef.current.getAudioTracks()[0]
    if(audioTrack){
      const newState = !audioEnabled
        audioTrack.enabled =  newState
      setAudioEnabled(newState)
      socket.emit("toggle-audio",{
        roomId,
        audioEnabled:newState
      })
   
    
    }

  }

 }
 // Toggle local camera
  const toggleVideo = ()=>{
     if(!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0]
    if(videoTrack){
      const newState = !videoEnabled
      videoTrack.enabled = newState
      setVideoEnabled(newState)
      socket.emit("toggle-video",{
        roomId,
        videoEnabled:newState
      })
   
    }

 
}

// End Meeting for evryone
const endMeeting = useCallback(()=>{

if(roomId){
  socket.emit("end-meeting",{
    roomId
  })
}


},[roomId])

return{
  localStream,
  remoteUsers,
  audioEnabled,
  videoEnabled,
  toggleAudio,
  toggleVideo,
  endMeeting
}

}
export default useWebRTC;