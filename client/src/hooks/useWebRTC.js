import React, { captureOwnerStack, useCallback, useEffect, useRef, useState } from 'react'
import {socket} from "../config/socket"
import toast from 'react-hot-toast';
import {useAuth} from "@clerk/react"



const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
    ],
};

const useWebRTC = (roomId,user,onMeetingEnded,enabled = true) => {
  
const {getToken,isLoaded,isSignedIn} = useAuth()
  const [localStream,setLocalStream] = useState(null)
  const [remoteUsers,setRemoteUsers] = useState([]) // Array of { socketId, userId, userName, stream, audioEnabled, videoEnabled }
  const [audioEnabled,setAudioEnabled] = useState(true)
  const [videoEnabled,setVideoEnabled] = useState(true)
  const [captureStream,setCaptureStream] = useState(null)
  const [screenRecording,setScreenRecording] = useState(false)

  

  const peersRef = useRef(new Map()) // socketId -> RTCPeerConnection of remote participants
  const localStreamRef = useRef(null)
  const captureStreamRef = useRef(null)
  const screenShareRequestVersionRef = useRef(0)

  
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
        setAudioEnabled(false)
        setVideoEnabled(false)
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

         peer.polite = socket.id>targetSocketId
      peer.onconnectionstatechange = ()=>{
        const state = peer.connectionState;
       
        if(state === "closed"|| state == "failed"){
          peer.close()
          if(peersRef.current.get(targetSocketId)===peer){
          peersRef.current.delete(targetSocketId)

          setRemoteUsers(prev=> (prev ?? []).filter((u)=>u.socketId!==targetSocketId))
          }

        }
      }
       // Add local tracks to peer connection
      if(localStreamRef.current){
        localStreamRef.current.getTracks().forEach((track)=>{
        peer.addTrack(track,localStreamRef.current)
        })
      }

      if(captureStreamRef.current){
        captureStreamRef.current.getTracks().forEach((track)=> {
          peer.addTrack(track,captureStreamRef.current)
        })
      }

       peer.onnegotiationneeded = async ()=>{
        if(peer.signalingState !== "stable" || peer.makingOffer) return;
        try {
          peer.makingOffer = true;
    const offer = await peer.createOffer()
       // The other participant may have sent an offer while we awaited createOffer()
    if (peer.signalingState !== "stable") return;
    await peer.setLocalDescription(offer)
    socket.emit("offer",{
      targetSocketId,
      callerSocketId:socket.id,
      sdp:peer.localDescription,
      screenStreamId:captureStreamRef.current?.id ?? null
    })
        } catch (error) {
            console.error("Error during negotiation:", error);
        }
        finally{
       
         
          peer.makingOffer = false

        }

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
            if(!remoteStream) return;

             // Identify whether this is the screen or camera stream
             const isScreenShare = remoteStream.id === peer.remoteScreenStreamId

             console.log("REMOTE TRACK RECEIVED:",{
              socketId:targetSocketId,
              userName:targetUser?.userName,
              streamId:remoteStream.id
             });
             
            setRemoteUsers((prev)=> {
              // if a new presenter starts , remove the previous screen form UI
              
              
              const updatedUsers = isScreenShare ? (prev).map((user)=>({
                ...user,
                screenStream:null
              })):[...prev]

             const existingIndex = updatedUsers.findIndex((u)=> u.socketId === targetSocketId)
             
             if(existingIndex>-1){
              const updated  = [...updatedUsers]
              updated[existingIndex] = {
                ...updated[existingIndex],
                ...(isScreenShare
                  ?{
                      screenStream:remoteStream
                  }:{
                     cameraStream:remoteStream,
                     stream:remoteStream
                  }
                )
               
              }
              return updated
             }
             else{
              return [
                ...updatedUsers,
                {
                  socketId:targetSocketId,
                  userId:targetUser?.userId,
                  userName:targetUser?.userName || "Partcipant",
                  cameraStream: isScreenShare?null:remoteStream,
                  screenStream:isScreenShare?remoteStream:null,
                  stream:isScreenShare?null:remoteStream,
                 audioEnabled:targetUser?.audioEnabled ?? true,
                 videoEnabled:targetUser?.videoEnabled ?? true

                }

              ]
             }

           })

           if(isScreenShare){
            event.track.onended = ()=>{
              setRemoteUsers((prev)=> (prev).map((user)=>
                user.socketId === targetSocketId && user.screenStream === remoteStream
                ?{...user,screenStream:null}:user
              ))
            }
           }
          
              
           }

 peersRef.current.set(targetSocketId,peer)


 return peer

   },[])


   const initScreenShare  = async()=>{


  try {
      if(!navigator.mediaDevices?.getDisplayMedia){
    toast.error("Screen sharing is not supported by this browser")
    return null;
  }

       const stream = await navigator.mediaDevices.getDisplayMedia({
    video:{
      displaySurface:"browser",
    },
    audio:{
        suppressLocalAudioPlayback:false,
    },
    selfBrowserSurface:"exclude",
    systemAudio:"exclude",
    surfaceSwitching:"include",
    monitorTypeSurfaces:"include"


    
   })
 
        captureStreamRef.current = stream
        setCaptureStream(stream)
        setScreenRecording(true)
         return stream;
  } catch (error) {
           console.error("Error starting screen share:", error);
              if (error.name !== "NotAllowedError") {
      toast.error("Unable to start screen sharing");
    }
    return null
  }



  
      
   




   }
const handleScreenShareEnded = ()=>{
 stopScreenShare();
}
   const startScreenShare = async()=>{

    if(captureStreamRef.current) return;

    socket.emit("request-screen-share",{
      roomId
    })

   }
   const stopScreenShare = ()=>{
    const stream = captureStreamRef.current
    if(!stream) return;

    const screenTrack = stream.getVideoTracks()[0];

    peersRef.current.forEach((peer)=>{
      if(peer.signalingState === "closed") return;
     const sender  = peer.getSenders().find((sender)=>sender.track === screenTrack)
       if(sender){
    peer.removeTrack(sender)
   }
    })

    stream.getTracks().forEach((track)=>track.stop())

  captureStreamRef.current = null;
  setCaptureStream(null)
  setScreenRecording(false)

  //Release presenter ownership on server


  socket.emit("cancel-screen-share",{
    roomId
  })


 

   }




   // Main WebRTC & Socket signaling setup effect

  useEffect(()=>{

    console.log("WEBRTC EFFECT STARTED",{
    roomId,
    userId: user?.id,
    isLoaded,
    isSignedIn,
    enabled,
    socketId: socket.id,
    connected: socket.connected
    })

if(!isLoaded || !isSignedIn || !roomId || !user || !enabled) return;



let isMounted = true;

let hasConnectedOnce = false;

const hanldeSocketConnect = ()=>{
      // Clean up only when reconnecting but not on the first connection

      console.log("SOCKET CONNECT EVENT", {
    socketId: socket.id,
    hasConnectedOnce
});
  if(hasConnectedOnce){
    peersRef.current.forEach(peer =>peer.close())
    peersRef.current.clear();

    icecandidateQueue.current.clear()
    processingCandidates.current.clear()

    setRemoteUsers([])
  }

  hasConnectedOnce = true
  joinRoom()
  }

  //Join only after connection
const joinRoom = ()=>{
  console.log("FRONTEND JOIN ROOM EMITTED", {
    socketId: socket.id,
    roomId,
    userId: user?.id
});
  socket.emit("join-room",{
    roomId,
    user,
    audioEnabled:mediaRef.current.audioEnabled,
    videoEnabled:mediaRef.current.videoEnabled
  })

} 

const handleAllUsers = async({users,activePresenterId})=>{
 for(const existingUser of users){
  if(!isMounted) return;
  const peer = createPeerConnection(
    existingUser.socketId,
    existingUser
  )

 
 }

}

const handleUserJoined = (newUser)=>{
  toast(`${newUser.userName} joined the meeting` , { icon: "👋" })
      createPeerConnection(newUser.socketId,newUser)

     
}

console.log("FRONTEND USER JOINED EVENT", {
    socketId: newUser.socketId,
    userId: newUser.userId
});

const handleOffer = async ({callerSocketId, sdp,callerUser,screenStreamId})=>{

 const peer = createPeerConnection(callerSocketId,callerUser)

 const offerCollition = peer.signalingState !=="stable" || peer.makingOffer

 peer.ignoreOffer = !peer.polite && offerCollition

 if(peer.ignoreOffer){
   icecandidateQueue.current.delete(callerSocketId)
  return;
 }

           try {
             if(offerCollition && peer.signalingState === "have-local-offer") await peer.setLocalDescription({type:"rollback"})

            peer.remoteScreenStreamId = screenStreamId  
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
              sdp:peer.localDescription,
                screenStreamId:captureStreamRef.current?.id ?? null
            })

            
           } catch (err) {
              console.error("Error handling offer:", err);
           }


}

const handleAnswer = async ({responderSocketId,sdp,screenStreamId})=>{
              const peer = peersRef.current.get(responderSocketId);
              if(peer){
                try {
                  peer.remoteScreenStreamId = screenStreamId
                  await peer.setRemoteDescription(new RTCSessionDescription(sdp))
                      if (!isMounted) return;
                  await processCandidateQueue(responderSocketId,peer)

                } catch (error) {
                   console.error("Error setting remote description from answer:", error);
                }
              }
         }

         const handleScreenShareApproved = async ()=>{
              // Capture the current request version before starting async work
                   const requestversion = screenShareRequestVersionRef.current
               const stream = await initScreenShare()
           
               if(requestversion!==screenShareRequestVersionRef.current){
                 stopScreenShare()
                 return;
                }
              if(!stream){
                socket.emit("cancel-screen-share",{
                  roomId
                })
                return;
              }
              const screenTrack = stream.getVideoTracks()[0]

               if(!screenTrack){
                stopScreenShare()
                return
               }

               peersRef.current.forEach(((peer)=>{
                if(peer.signalingState !== "closed") peer.addTrack(screenTrack,stream)
               }))

               screenTrack.onended = ()=>{
                handleScreenShareEnded()
            }
            }

            const handleForceStopScreenShare = ()=>{
              console.log("Another participant started sharing.Stopping your screen share");
              screenShareRequestVersionRef.current+=1;
              stopScreenShare()
              
            }



      const handleIceCandidate = async ({senderSocketId,candidate})=>{

            try {
               const peer = peersRef.current.get(senderSocketId)
               if(peer?.ignoreOffer) return;
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
                setRemoteUsers((prev)=>(prev).map(
                  (u)=> u.socketId == socketId ? {...u,audioEnabled}:u
                ))

              }

              const handleUserVideoToggle = ({socketId,videoEnabled})=>{
                setRemoteUsers((prev)=>(prev).map(
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
                  console.log("USER LEFT:",{
                   socketId,
                   userName:leftUser?.userName

                  })
                 // Clean up pending ICE candidate

                 icecandidateQueue.current.delete(socketId)

                 setRemoteUsers((prev)=>(prev??[]).filter((u)=> u.socketId!==socketId))
                   

              
               
                 
                }

                const handleScreenShareStopped =  ({socketId})=>{
                  setRemoteUsers((prev)=>
                    (prev).map((remote)=>
                      remote.socketId ===socketId?{...remote,screenStream:null}:
                      remote
                    )
                  )
                }

                const handleMeetingEnded = ({message})=>{
                      toast.error(message||"This meeting has ended")
                      if(onMeetingEnded){
                    onMeetingEnded(message)
                      }
                    
                  
                     }

                const handleSocketConnectError = (error)=>{
                   console.error("Socket connection failed:", {
        message: error.message,
        description: error.description,
        context: error.context,
        type: error.type
    });

                  toast.error(error.message||"Unable to connect to meeting")
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

            socket.on("screen-share-approved", handleScreenShareApproved);

            socket.on("force-stop-screen-share",handleForceStopScreenShare)

            socket.on("screen-share-stopped",handleScreenShareStopped)

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



socket.on("connect",hanldeSocketConnect);
socket.on("connect_error",handleSocketConnectError)
const connectSocket = async ()=>{
  try {
      socket.auth = async (callback)=>{
try {
    const freshToken = await getToken({
      skipCache:true
    })

    if(!freshToken){
       console.error("Clerk token not found");
       callback({token:null})
       return;
    }

    callback({token:freshToken})

 
  } catch (error) {
      console.error("Token refresh failed:", error);
         callback({token:null})
  }
  }

  if(!socket.connected){
    console.log("CALLING SOCKET.CONNECT", {
    connected: socket.connected,
    socketId: socket.id
});
    socket.connect();
  
  }
  else{
   hanldeSocketConnect()
  }
    
  } catch (error) {
     console.error("Socket connection error:", error);
  }

  
}



connectSocket()



                    

}

  startSession();

  


         // Cleanup on leave/unmount

  return ()=>{
    console.log("WEBRTC EFFECT CLEANUP", {
    socketId: socket.id,
    connected: socket.connected,
    roomId
});
    isMounted = false
          
 

     // Close all peer connections
    peersRef.current.forEach((peer)=>peer.close())
    peersRef.current.clear()

       // Off socket listeners
       socket.off("connect",hanldeSocketConnect)
   socket.off("all-users",handleAllUsers)
   socket.off("user-joined",handleUserJoined)
   socket.off("offer",handleOffer)
   socket.off("answer",handleAnswer)
  socket.off("ice-candidate",handleIceCandidate)
  socket.off("user-toggled-audio",handleUserAudioToggle)
  socket.off("user-toggled-video",handleUserVideoToggle);
  socket.off("user-left",handleUserLeft);
  socket.off("meeting-ended",handleMeetingEnded);
  socket.off("connect_error", handleSocketConnectError);
 socket.off("screen-share-approved", handleScreenShareApproved);
socket.off("force-stop-screen-share", handleForceStopScreenShare);
socket.off("screen-share-stopped", handleScreenShareStopped);
  if(captureStreamRef.current){
    captureStreamRef.current.getTracks().forEach((track)=>track.stop())
  }
  captureStreamRef.current = null;
  socket.emit("cancel-screen-share",{
    roomId
  })
  setCaptureStream(null)
  setScreenRecording(false)

   socket.emit("leave-room")
 

   setRemoteUsers([])
   
  icecandidateQueue.current.clear()
  processingCandidates.current.clear();
// Stop local tracks
  if(localStreamRef.current){
    localStreamRef.current.getTracks().forEach(track=>track.stop())
    localStreamRef.current = null;
  }

  }


  },[roomId,user?.id,enabled,createPeerConnection,initLocalStream,onMeetingEnded,getToken,isLoaded,isSignedIn])


  


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
  captureStream,
  remoteUsers,
  audioEnabled,
  videoEnabled,
  toggleAudio,
  toggleVideo,
  endMeeting,
  screenRecording,
  startScreenShare,
  stopScreenShare,
  
}

}
export default useWebRTC;