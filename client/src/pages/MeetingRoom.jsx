import React, { useState,useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { dummyMeetingDetails, dummyRemoteParticipants, dummyUser } from '../assets/asset'


import VideoGrid from '../components/meeting/VideoGrid'
import useWebRTC from '../hooks/useWebRTC'
import ChatPanel from '../components/meeting/ChatPanel'
import { useChat } from '../hooks/useChat'
import ParticipantList from '../components/meeting/ParticipantList'
import ControlBar from '../components/meeting/ControlBar'
import toast from 'react-hot-toast'



const MeetingRoom = () => {
   
  const {meetingId} = useParams()
  const navigate = useNavigate()
  const userData = dummyUser;
  const [isParticipantOpen,setIsParticipantOpen] = useState(false)


  const handleMeetingEnded = useCallback(()=>{
    navigate("/dashboard")
  },[navigate])

  // Initialize WebRTC

  const {localStream,remoteUsers,audioEnabled,videoEnabled,toggleAudio,toggleVideo,endMeeting} = useWebRTC(meetingId,userData,handleMeetingEnded)

  // Initialize Chat

  const {messages,sendMessage,unreadCount,isChatOpen,toggleChat} = useChat(meetingId,userData)


  const isHost = true;

  const handleLeave = ()=>{
    toast("You left the meeting")
    navigate("/dashboard")
  
  }

    const handleEndMeeting = ()=>{
     endMeeting();
     toast("Meeting ended for all participants")
    
  } 



  return (
    <div className='h-screen w-screen bg-slate-100 text-slate-900 flex flex-col overflow-hidden relative font-sans'>
      {/* Topbar */}
      <header className='w-full bg-white/90 backdrop-blur-md px-6 py-3 border-b border-slate-200 flex items-center justify-between z-30 shadow-xs'>
      <div className='flex items-center gap-3'>
        <h2 className='text-base font-semibold text-slate-900 tracking-tight '>
          {dummyMeetingDetails.title} ({meetingId||dummyMeetingDetails.meetingId})
        </h2>
        <span className='size-1.5 rounded-full bg-emerald-500 animate-pulse'/>
      </div>
      </header>
      {/* Main Content Area (Video Grid+ Side Panels) */}
      <div className='flex-1 flex overflow-hidden'>
        {/* Video Grid Center */}
        <VideoGrid 
        localStream={localStream}
        localUser={userData}
        remoteUsers={remoteUsers}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}

        />

        {/* In-Meeting Chat Drawer */}
        <ChatPanel 
        isOpen = {isChatOpen}
         onClose = {toggleChat}
         messages = {messages}
         onSendMessage = {sendMessage}
         currentUser = {userData}
         
        />

        {/* Participants Drawer */}

        <ParticipantList
         isOpen = {isParticipantOpen}
        onClose = {()=> setIsParticipantOpen(false)}
        localUser = {userData}
        localAudio = {audioEnabled}
        localVideo = {videoEnabled}
        remoteUsers = {remoteUsers}
        meetingHostId = {dummyUser.id}
        />


    

      </div>

          {/* Bottom Floating Control Bar */}

        <ControlBar
        roomId = {meetingId||dummyMeetingDetails.meetingId}
        audioEnabled = {audioEnabled}
        VideoEnabled = {videoEnabled}
        OnToggleAudio = {toggleAudio}
        OnToggleVideo = {toggleVideo}
        onToggleChat = {toggleChat}
        onToggleParticipants ={()=> setIsParticipantOpen((prev)=>!prev)}
         isChatOpen = {isChatOpen}
         isParticipantOpen =  {isParticipantOpen}
        unreadCount = {unreadCount}
         participantCount ={1+remoteUsers.length}
        isHost = {isHost}
        onLeave = {handleLeave}
        onEndMeeting = {handleEndMeeting}

        />
  
     <div>

     </div>
    </div>

  )
}

export default MeetingRoom