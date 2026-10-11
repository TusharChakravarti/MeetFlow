import React, { useState } from 'react'

const ControlBar = ({roomId,audioEnabled,VideoEnabled,OnToggleAudio,OnToggleVideo,onToggleChat,onToggleParticipants, isChatOpen,isParticipantOpen,unreadCount ,participantCount,isHost,onLeave,onEndMeeting}) => {
    const [copied,setCopied] = useState(false)

    const copyMeetingId = ()=>{
         
    }
  return (
    <div>ControlBar</div>
  )
}

export default ControlBar