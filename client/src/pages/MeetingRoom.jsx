import React, { useState,useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { dummyMeetingDetails, dummyUser } from '../assets/asset'



const MeetingRoom = () => {
  const {meetingId} = useParams()
  const navigate = useNavigate()
  const userData = dummyUser;
  const [isParticipationOpen,setIsParticipationOpen] = useState(false)
  const handleMeetingEnded = useCallback(()=>{
    navigate("/dashboard")
  },[navigate])

  const isHost = true;

  const handleLeave = ()=>{
  
  }

    const handleEndMeeting = ()=>{
    
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

        {/* In-Meeting Chat Drawer */}

        {/* Participants Drawer */}

        {/* Bottom Floating Control Bar */}

      </div>
  
     <div>

     </div>
    </div>

  )
}

export default MeetingRoom