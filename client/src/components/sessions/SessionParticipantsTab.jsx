import { CrownIcon, UserIcon } from 'lucide-react'
import React from 'react'

const SessionParticipantsTab = ({participants = [],host}) => {
        if(participants.length === 0) {
        return(
            <div className='h-full flex flex-col items-center justify-center text-slate-400 text-sm py-12'>
                <UserIcon  className='w-8 h-8 mb-2 text-slate-300'/>
                <p>No participant log recorded</p>
            </div>
        )
    }
    const hostId = host?.id;
  return (
    <div className='space-y-2.5'>
        {participants.map((p,idx)=>{
            const participantUserId = p.user?.id || p.user; 
            const isHost = Boolean(hostId && participantUserId && participantUserId.toString()===hostId.toString())

            return (
                <div key={idx} 
                className='flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100'
                >
                    <div className='flex items-center gap-3'>
                      <div
                      className='w-9 h-9 rounded-full bg-cyan-50 border border-cyan-200 text-primary font-bold flex items-center justify-center text-sm '
                      >
                        {p.name ? p.name.charAt(0).toUpperCase() :"?"}
                      </div>
                      <div>
                        <span className='text-sm font-semibold text-slate-800 flex items-center gap-1.5'>
                            {p.name}
                            {isHost && <CrownIcon className='w-3.5 h-3.5 text-amber-500 ' title = "Host"/>}
                        </span>

                        {p.user?.email && <span className='text-xs text-slate-400'>{p.user.email}</span>}
                      </div>
                    </div>
                       <span className='text-xs text-slate-500 font-mono'>
                        Joined : {new Date(p.joinedAt).toLocaleTimeString([],{
                          hour:"2-digit",
                          minute:"2-digit"
                        })}
                       </span>

                </div>
            )
        })
        
        }
    </div>
  )
}

export default SessionParticipantsTab






 {/* {
        id: 1,
        meetingId: "qwe-rty-uio",
        title: "Sprint Planning & Roadmap Review",
        status: "ended",
        createdAt: "2026-08-14T09:30:00.000Z",
        endedAt: "2026-08-14T10:45:00.000Z",
        host: {
            id: "user_mock_001",
            name: "Alex Rivera",
            email: "alex.rivera@example.com",
        },
        participants: [
            {
                user: { id: "user_mock_001", email: "alex.rivera@example.com" },
                name: "Alex Rivera",
                joinedAt: "2026-08-14T09:30:00.000Z",
                leftAt: "2026-08-14T10:45:00.000Z",
            },
            {
                user: { id: "user_mock_002", email: "sarah.chen@example.com" },
                name: "Sarah Chen",
                joinedAt: "2026-08-14T09:31:12.000Z",
                leftAt: "2026-08-14T10:44:20.000Z",
            },
            {
                user: { id: "user_mock_003", email: "marcus.vance@example.com" },
                name: "Marcus Vance",
                joinedAt: "2026-08-14T09:32:05.000Z",
                leftAt: "2026-08-14T10:45:00.000Z",
            },
            {
                user: { id: "user_mock_004", email: "elena.rostova@example.com" },
                name: "Elena Rostova",
                joinedAt: "2026-08-14T09:35:40.000Z",
                leftAt: "2026-08-14T10:40:15.000Z",
            },
        ],
        messages: [
            {
                id: "m1",
                senderId: "user_mock_001",
                senderName: "Alex Rivera",
                text: "Welcome everyone! Let's kick off with the Q3 milestone updates.",
                timestamp: "2026-08-14T09:31:00.000Z",
            },
            {
                id: "m2",
                senderId: "user_mock_002",
                senderName: "Sarah Chen",
                text: "The frontend redesign is 90% completed and currently in QA review.",
                timestamp: "2026-08-14T09:34:10.000Z",
            },
            {
                id: "m3",
                senderId: "user_mock_003",
                senderName: "Marcus Vance",
                text: "Backend API endpoints are ready on staging server.",
                timestamp: "2026-08-14T09:36:22.000Z",
            },
            {
                id: "m4",
                senderId: "user_mock_001",
                senderName: "Alex Rivera",
                text: "Awesome work team. Let's aim for shipping next Wednesday!",
                timestamp: "2026-08-14T09:42:00.000Z",
            },
        ],
    }, */}