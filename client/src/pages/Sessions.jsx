import { ArrowLeft } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { dummySessions } from '../assets/asset'
import EmptySessions from '../components/sessions/EmptySessions'
import SessionCard from '../components/sessions/SessionCard'
import SessionDetailModal from '../components/sessions/SessionDetailModal'
import { useAuth } from '@clerk/react'
import api from '../config/api'
import toast from 'react-hot-toast'
import Loader from '../components/Loader'

const Sessions = () => {
  const[sessions,setSessions]  = useState([])
  const [selectedSession,setSelectedSession] = useState(null)
  const navigate = useNavigate()
  const [loading,seLoading] = useState(true)
  const {isLoaded,isSignedIn,getToken} = useAuth()

  useEffect(()=>{
    const fetchSessions = async ()=>{
      if(!isLoaded||!isSignedIn) return;

      try {
       const token = await getToken()
        if(!token) return;
      const response = await api.get("/api/meetings/sessions",{
      headers:{
        Authorization:`Bearer ${token}`
      }
    })

     setSessions(response.data.meetings||[])
        
      } catch (_error) {
     
        
        toast.error("Failed to load meeting sessions")
      }
      finally{
        seLoading(false)
      }

    }
    fetchSessions()

  },[isLoaded,isSignedIn,getToken])

  const  openSessionDetails = async(sessionId)=>{
    try {
      const token = await getToken()
      const response = await api.get(`api/meetings/sessions/${sessionId}`,{
        headers:{
          Authorization:`Bearer ${token}`
        }
      })
   
      

      setSelectedSession(response.data.meetings)


    } catch (_error) {
      console.error(_error.message);
      console.log("hi");
      
      
     toast.error("Could not fetch session details")
      
    }



  }
  if(loading){
    return <Loader text='Loading meeting history...'/>
  }

  return (
   <main className='flex-1 max-w-7xl w-full mx-auto p-6 md:p-12'>
       {/* Page Titke & Navigation Header */}

   <Link to="/dashboard"
   className='flex items-center text-sm gap-1 mb-4 text-slate-500 hover:text-slate-900 transition-colors'
   >
   <ArrowLeft size={14} /> Go To Dashboard
   </Link>
   <div className='mb-8'>
    <h1 className='text-3xl font-medium tracking-tight text-slate-900'>Meeting sessions.</h1>
    <p className='text-sm text-slate-500 mt-1'>Review Your past and active meeting history,participant logs, and chat transcripts.</p>
   </div>

     

   {/* Session Grid/Empty State */}

 {
  sessions.length===0?(
    <EmptySessions/>
  ):(
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
    {sessions.map((session)=>(
       <SessionCard
       key={session.id}
       session={session}
       onOpenDetails={openSessionDetails}
       onRejoin={(meetingId)=>(
        navigate(`/meeting/${  meetingId}`)


    )}


      />
    ))}
    </div>
  )
 }
 {/* Session Detail Modal  */}
 <p><SessionDetailModal session={selectedSession} onClose={()=> setSelectedSession(null)}/></p>

   </main>

  )
}

export default Sessions